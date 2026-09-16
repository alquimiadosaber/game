/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — PasswordService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Serviço de gestão de senhas. Novas credenciais usam digest SHA-256
 *   versionado e salt exclusivo por utilizador nos campos PasswordHash e
 *   PasswordSalt. Registros legados em texto plano são aceitos somente para
 *   leitura e convertidos no próximo fluxo de migração.
 *
 *   Para dados legados, execute migrateAlquimiaPasswords() uma vez no editor
 *   do Apps Script. O comando converte os valores antigos e os remove.
 *
 * FUNCIONALIDADES:
 *   • changePassword(userId, oldPassword, newPassword) — Altera senha após
 *     confirmar a senha atual.
 *   • resetPassword(email, newPassword) — Redefine a senha por e-mail. Gera
 *     uma senha temporária aleatória quando newPassword não é informada ou
 *     não atende à política mínima de comprimento.
 *   • verifyPassword(userId, password) — Compara o digest sem expor o segredo.
 *   • createCredential(password) — Gera salt e digest para cadastro e seeds.
 *
 * AVISO DE SEGURANÇA (resetPassword):
 *   Esta função assume que o chamador (fluxo de "esqueci a senha") já
 *   validou a posse do e-mail — por exemplo, via link/token de uso único
 *   enviado por NotificationService — antes de a invocar. Nunca exponha
 *   resetPassword diretamente a partir do cliente sem essa validação prévia,
 *   sob risco de permitir sequestro de conta apenas com o e-mail da vítima.
 *
 * ESQUEMA DA ABA Users (colunas relevantes a este serviço):
 *   UserID | Email | PasswordHash | PasswordSalt | PasswordUpdatedAt
 *   (PasswordUpdatedAt é opcional/informativo — usado se existir na aba.)
 *
 * INTEGRAÇÕES:
 *   • Utils — acesso à aba Users, geração de timestamp.
 *   • LockService — evita corridas em alterações concorrentes de senha.
 *   • LoggerService.logAuth() — auditoria de troca/recuperação (opcional).
 *   • ValidationService.validatePassword() — política de senha (opcional;
 *     cai para verificação mínima local de comprimento se ausente).
 *
 * PADRÕES:
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.3.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const PasswordService = (function () {

  var MIN_PASSWORD_LENGTH = 8;
  var TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  var HASH_VERSION = 'v1';

  function _hash(password, salt) {
    var value = String(password === null || password === undefined ? '' : password);
    var resolvedSalt = String(salt || '');
    if (!resolvedSalt) resolvedSalt = _newSalt();
    var input = resolvedSalt + ':' + value;
    var bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      input,
      Utilities.Charset.UTF_8
    );
    if (Utilities.base64Encode) return Utilities.base64Encode(bytes);
    return Array.prototype.map.call(bytes || [], function (byte) {
      var normalized = (Number(byte) + 256) % 256;
      return normalized.toString(16).padStart(2, '0');
    }).join('');
  }

  function _newSalt() {
    if (typeof Utilities !== 'undefined' && Utilities.getUuid) return String(Utilities.getUuid());
    return 'salt-' + new Date().getTime() + '-' + Math.random();
  }

  function _constantTimeEqual(left, right) {
    left = String(left || '');
    right = String(right || '');
    var different = left.length ^ right.length;
    var length = Math.max(left.length, right.length);
    for (var i = 0; i < length; i++) {
      different |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
    }
    return different === 0;
  }

  function _getUsersSheet() {
    var sheet = Utils.getSheet('Users');
    if (!sheet) {
      if (typeof Logger !== 'undefined') {
        Logger.log('[PasswordService] ERRO: Dados de usuários não disponíveis');
      }
      return null;
    }
    return sheet;
  }

  function _findUserRow(matchField, matchValue) {
    var sheet = _getUsersSheet();
    if (!sheet) return null;
    
    try {
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var index = {};
      headers.forEach(function (h, i) {
        var name = String(h || '');
        index[name] = i;
        index[name.toLowerCase()] = i;
        if (name.toLowerCase() === 'userid' || name.toLowerCase() === 'id') index.UserID = i;
        if (name.toLowerCase() === 'passwordhash' || name.toLowerCase() === 'senhahash') index.PasswordHash = i;
        if (name.toLowerCase() === 'passwordsalt' || name.toLowerCase() === 'senhasalt') index.PasswordSalt = i;
        if (name.toLowerCase() === 'password' || name.toLowerCase() === 'senha') index.LegacyPassword = i;
        if (name.toLowerCase() === 'email' || name.toLowerCase() === 'e-mail') index.Email = i;
        if (name.toLowerCase() === 'passwordupdatedat') index.PasswordUpdatedAt = i;
      });
      var aliases = {
        UserID: ['UserID', 'userid', 'ID', 'id', 'userId'],
        PasswordHash: ['PasswordHash', 'passwordHash', 'SenhaHash', 'senhaHash'],
        PasswordSalt: ['PasswordSalt', 'passwordSalt', 'SenhaSalt', 'senhaSalt'],
        LegacyPassword: ['Password', 'password', 'Senha', 'senha'],
        Email: ['Email', 'email', 'E-mail']
      };
      var candidates = aliases[matchField] || [matchField];
      var col;
      for (var c = 0; c < candidates.length; c++) {
        if (index[candidates[c]] !== undefined) { col = index[candidates[c]]; break; }
        if (index[String(candidates[c]).toLowerCase()] !== undefined) { col = index[String(candidates[c]).toLowerCase()]; break; }
      }
      if (col === undefined) {
        if (typeof Logger !== 'undefined') {
          Logger.log('[PasswordService] ERRO: Campo de busca não encontrado: ' + matchField);
        }
        return null;
      }
      for (var i = 1; i < values.length; i++) {
        var rowMatchValue = String(values[i][col]);
        var requestedMatchValue = String(matchValue);
        var matches = matchField === 'Email'
          ? rowMatchValue.toLowerCase() === requestedMatchValue.toLowerCase()
          : rowMatchValue === requestedMatchValue;
        if (matches) {
          // Uma migração aditiva pode deixar `Password` vazio ao lado da coluna
          // legada `Senha`. Para esta linha, escolha a coluna que realmente tem
          // valor; caso contrário uma credencial correta parece inválida.
          var resolvedIndex = Object.assign({}, index);
          Object.keys(aliases).forEach(function (field) {
            var fieldCandidates = aliases[field];
            var firstExisting;
            for (var a = 0; a < fieldCandidates.length; a++) {
              for (var h = 0; h < headers.length; h++) {
                if (String(headers[h] || '').toLowerCase() !== String(fieldCandidates[a]).toLowerCase()) continue;
                if (firstExisting === undefined) firstExisting = h;
                if (values[i][h] !== '' && values[i][h] !== null && values[i][h] !== undefined) {
                  resolvedIndex[field] = h;
                  return;
                }
              }
            }
            if (resolvedIndex[field] === undefined && firstExisting !== undefined) resolvedIndex[field] = firstExisting;
          });
          return { rowNumber: i + 1, row: values[i], index: resolvedIndex, sheet: sheet };
        }
      }
      return null;
    } catch (err) {
      if (typeof Logger !== 'undefined') {
        Logger.log('[PasswordService] Erro ao buscar usuário: ' + err.message);
      }
      return null;
    }
  }

  function _generateTemporaryPassword() {
    var pwd = '';
    for (var i = 0; i < 12; i++) {
      pwd += TEMP_PASSWORD_ALPHABET.charAt(Math.floor(Math.random() * TEMP_PASSWORD_ALPHABET.length));
    }
    return pwd;
  }

  function _isPasswordStrongEnough(password) {
    if (typeof password !== 'string') return false;
    try {
      if (typeof ValidationService !== 'undefined' && ValidationService.validatePassword) {
        var result = ValidationService.validatePassword(password);
        if (result && typeof result.success === 'boolean') return result.success;
      }
    } catch (err) {
      // Cai para a verificação mínima local abaixo.
    }
    return password.length >= MIN_PASSWORD_LENGTH;
  }

  function _setUserPassword(match, password) {
    try {
      var index = match.index;
      if (index.PasswordHash === undefined || index.PasswordSalt === undefined) {
        if (typeof Logger !== 'undefined') {
          Logger.log('[PasswordService] ERRO: Estrutura de dados inválida');
        }
        return false;
      }
      var credential = createCredential(password);
      match.sheet.getRange(match.rowNumber, index.PasswordHash + 1).setValue(credential.hash);
      match.sheet.getRange(match.rowNumber, index.PasswordSalt + 1).setValue(credential.salt);
      if (index.LegacyPassword !== undefined) match.sheet.getRange(match.rowNumber, index.LegacyPassword + 1).clearContent();
      if (index.PasswordUpdatedAt !== undefined) {
        match.sheet.getRange(match.rowNumber, index.PasswordUpdatedAt + 1).setValue(Utils.getTimestamp());
      }
      return true;
    } catch (err) {
      if (typeof Logger !== 'undefined') {
        Logger.log('[PasswordService] Erro ao definir senha: ' + err.message);
      }
      return false;
    }
  }

  function verifyPassword(userId, password) {
    try {
      var match = _findUserRow('UserID', userId);
      if (!match) return { success: false, data: false, error: 'Utilizador não encontrado.' };
      var stored = String(match.row[match.index.PasswordHash] || '');
      var legacy = match.index.LegacyPassword === undefined
        ? '' : String(match.row[match.index.LegacyPassword] || '');
      // Não aplique trim: espaços nas extremidades também fazem parte da
      // credencial informada no cadastro e precisam continuar sendo aceitos.
      var candidate = String(password === null || password === undefined ? '' : password);
      var salt = String(match.row[match.index.PasswordSalt] || '');
      var valid = Boolean(stored && salt && _constantTimeEqual(stored, _hash(candidate, salt)));
      // Compatibilidade de leitura: uma conta sem salt ainda pode autenticar,
      // mas a próxima migração/troca de senha a converte para v1.
      if (!valid && !salt && stored) valid = _constantTimeEqual(stored, candidate);
      if (!valid && !stored && legacy) valid = _constantTimeEqual(legacy, candidate);
      return { success: true, data: Boolean(valid), error: null };
    } catch (err) {
      return { success: false, data: false, error: 'Erro ao verificar credenciais.' };
    }
  }

  function changePassword(userId, oldPassword, newPassword) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var check = verifyPassword(userId, oldPassword);
      if (!check.success || !check.data) {
        return { success: false, data: null, error: 'Senha atual incorreta.' };
      }
      if (!_isPasswordStrongEnough(newPassword)) {
        return { success: false, data: null, error: 'Nova senha não atende aos requisitos mínimos (mín. ' + MIN_PASSWORD_LENGTH + ' caracteres).' };
      }
      var match = _findUserRow('UserID', userId);
      if (!match) return { success: false, data: null, error: 'Utilizador não encontrado.' };
      
      var success = _setUserPassword(match, newPassword);
      if (!success) {
        return { success: false, data: null, error: 'Erro ao atualizar senha. Tente novamente.' };
      }
      
      try {
        if (typeof LoggerService !== 'undefined' && LoggerService.logAuth) {
          LoggerService.logAuth(userId, 'PASSWORD_CHANGE', '');
        }
      } catch (logErr) { /* auditoria é auxiliar */ }
      return { success: true, data: { userId: userId }, error: null };
    } catch (err) {
      return { success: false, data: null, error: 'Erro ao alterar senha. Tente novamente.' };
    } finally {
      lock.releaseLock();
    }
  }

  function resetPassword(email, newPassword) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var match = _findUserRow('Email', email);
      if (!match) return { success: false, data: null, error: 'Utilizador não encontrado.' };
      var passwordToSet = _isPasswordStrongEnough(newPassword) ? newPassword : _generateTemporaryPassword();
      
      var success = _setUserPassword(match, passwordToSet);
      if (!success) {
        return { success: false, data: null, error: 'Erro ao redefinir senha. Tente novamente.' };
      }
      
      try {
        if (typeof LoggerService !== 'undefined' && LoggerService.logAuth) {
          LoggerService.logAuth(match.row[match.index.UserID], 'PASSWORD_RESET', '');
        }
      } catch (logErr) { /* auditoria é auxiliar */ }
      return {
        success: true,
        data: { email: email, temporaryPassword: passwordToSet },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: 'Erro ao redefinir senha. Tente novamente.' };
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Executa o fluxo publico de "esqueci a senha" sem expor a senha temporaria
   * ao navegador e sem deixar a conta alterada quando o envio de e-mail falha.
   * A resposta e deliberadamente identica para e-mails existentes e ausentes.
   */
  function requestPasswordReset(email) {
    var lock = LockService.getScriptLock();
    var genericResult = {
      success: true,
      data: { requested: true },
      error: null,
      message: 'Se o e-mail estiver cadastrado, as instrucoes serao enviadas.'
    };
    try {
      lock.waitLock(10000);
      var normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail || normalizedEmail.indexOf('@') < 1) {
        return { success: false, data: null, error: 'Informe um e-mail valido.', message: 'Informe um e-mail valido.' };
      }

      var match = _findUserRow('Email', normalizedEmail);
      if (!match) return genericResult;

      var index = match.index;
      var previous = {
        hash: index.PasswordHash === undefined ? null : match.row[index.PasswordHash],
        salt: index.PasswordSalt === undefined ? null : match.row[index.PasswordSalt],
        legacy: index.LegacyPassword === undefined ? null : match.row[index.LegacyPassword],
        updatedAt: index.PasswordUpdatedAt === undefined ? null : match.row[index.PasswordUpdatedAt]
      };
      var temporaryPassword = _generateTemporaryPassword();
      if (!_setUserPassword(match, temporaryPassword)) {
        return genericResult;
      }

      var delivery = NotificationService.sendPasswordReset(normalizedEmail, temporaryPassword);
      if (!delivery || !delivery.success) {
        // O envio e a troca nao sao uma transacao nativa. Restaura exatamente
        // as celulas anteriores para que uma falha do MailApp nao tranque a conta.
        if (index.PasswordHash !== undefined) match.sheet.getRange(match.rowNumber, index.PasswordHash + 1).setValue(previous.hash || '');
        if (index.PasswordSalt !== undefined) match.sheet.getRange(match.rowNumber, index.PasswordSalt + 1).setValue(previous.salt || '');
        if (index.LegacyPassword !== undefined) match.sheet.getRange(match.rowNumber, index.LegacyPassword + 1).setValue(previous.legacy || '');
        if (index.PasswordUpdatedAt !== undefined) match.sheet.getRange(match.rowNumber, index.PasswordUpdatedAt + 1).setValue(previous.updatedAt || '');
        return genericResult;
      }

      try {
        if (typeof LoggerService !== 'undefined' && LoggerService.logAuth) {
          LoggerService.logAuth(match.row[index.UserID], 'PASSWORD_RESET_REQUEST', '');
        }
      } catch (logErr) { /* auditoria e auxiliar */ }
      return genericResult;
    } catch (err) {
      return genericResult;
    } finally {
      lock.releaseLock();
    }
  }

  function createCredential(password) {
    var salt = _newSalt();
    return { hash: _hash(password, salt), salt: salt };
  }

  function hashPassword(password, salt) {
    return _hash(password, salt);
  }

  function migrateLegacyPasswords() {
    if (typeof Sheets !== 'undefined' && Sheets.setup) {
      var setup = Sheets.setup(null, false);
      if (!setup.success) return setup;
    }
    var lock = LockService.getScriptLock();
    var migrated = 0;
    try {
      lock.waitLock(10000);
      var sheet = _getUsersSheet();
      if (!sheet) {
        return { success: false, data: { migrated: 0 }, error: 'Dados não disponíveis no momento.' };
      }
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var legacyIndex = headers.findIndex(function (h) { return ['password', 'senha'].indexOf(String(h).toLowerCase()) !== -1; });
      var hashIndex = headers.findIndex(function (h) { return ['passwordhash', 'senhahash'].indexOf(String(h).toLowerCase()) !== -1; });
      var saltIndex = headers.findIndex(function (h) { return ['passwordsalt', 'senhasalt'].indexOf(String(h).toLowerCase()) !== -1; });
      if (legacyIndex < 0 || hashIndex < 0 || saltIndex < 0) return { success: true, data: { migrated: 0 }, error: null };
      for (var i = 1; i < values.length; i++) {
        var legacy = String(values[i][legacyIndex] || '');
        if (!legacy || (values[i][hashIndex] && values[i][saltIndex])) continue;
        var credential = createCredential(legacy);
        sheet.getRange(i + 1, hashIndex + 1).setValue(credential.hash);
        sheet.getRange(i + 1, saltIndex + 1).setValue(credential.salt);
        sheet.getRange(i + 1, legacyIndex + 1).clearContent();
        migrated++;
      }
      return { success: true, data: { migrated: migrated }, error: null };
    } catch (err) {
      return { success: false, data: { migrated: migrated }, error: 'Erro na migração de senhas.' };
    } finally {
      lock.releaseLock();
    }
  }

  return {
    changePassword: changePassword,
    resetPassword: resetPassword,
    requestPasswordReset: requestPasswordReset,
    verifyPassword: verifyPassword,
    createCredential: createCredential,
    hashPassword: hashPassword,
    migrateLegacyPasswords: migrateLegacyPasswords
  };
})();

function migrateAlquimiaPasswords() {
  return PasswordService.migrateLegacyPasswords();
}
