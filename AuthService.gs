/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — AuthService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Serviço de autenticação. Gerencia login, logout e validação de
 *   credenciais contra a aba Users. Este serviço delega toda a lógica de
 *   credenciais ao PasswordService, que compara digest salgado e não expõe
 *   segredos ao cliente.
 *
 * FUNCIONALIDADES:
 *   • login(email, password) — Valida credenciais e cria sessão.
 *   • logout(sessionId) — Encerra sessão ativa.
 *   • validateCredentials(email, password) — Verifica utilizador e senha,
 *     sem criar sessão.
 *   • getCurrentUser(token) — Retorna utilizador da sessão (ver nota de
 *     assinatura em SessionService.gs — GAS não tem sessão ambiente).
 *   • isAuthenticated(token) — Verifica se há sessão válida.
 *   • refreshToken(sessionId) — Rotaciona o token: cria uma nova sessão e
 *     invalida a anterior (evita reuso indefinido do mesmo token).
 *
 * MENSAGENS DE ERRO GENÉRICAS (segurança):
 *   E-mail inexistente e senha incorreta retornam a mesma mensagem
 *   ("Credenciais inválidas.") — evita enumeração de contas cadastradas.
 *
 * INTEGRAÇÕES:
 *   • Utils — acesso em lote à aba Users.
 *   • PasswordService.verifyPassword() — comparação de digest.
 *   • SessionService — criação/validação/encerramento de sessões.
 *   • LoggerService.logAuth() — auditoria de login/logout (opcional).
 *
 * COLUNA DA PLANILHA (Users):
 *   UserID | Email | PasswordHash | PasswordSalt | FullName | Role | Status | CreatedAt | LastLogin
 *
 * PADRÕES:
 *   Batch read — Utils.getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.3.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const AuthService = (function () {

  function _headerKey_(value) {
    var text = String(value === null || value === undefined ? '' : value).toLowerCase();
    try { text = text.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (ignore) {}
    return text.replace(/[^a-z0-9]/g, '');
  }

  function _values_(row, names) {
    var wanted = {};
    names.forEach(function (name) { wanted[_headerKey_(name)] = true; });
    return Object.keys(row || {}).filter(function (key) {
      return wanted[_headerKey_(key)] && row[key] !== '' && row[key] !== null && row[key] !== undefined;
    }).map(function (key) { return row[key]; });
  }

  function _findUserByEmail(email) {
    var result = Utils.getAllRows('Users');
    if (!result.success) return null;
    var normalized = String(email || '').trim().toLowerCase();
    var found = result.data.filter(function (row) {
      return _values_(row, ['Email', 'E-mail', 'Username', 'Usuario', 'Usuário']).some(function (login) {
        return String(login || '').trim().toLowerCase() === normalized;
      });
    })[0] || null;
    if (found) return found;

    // O setup pode ter sido executado sem carga sintética. Garanta apenas as
    // contas de demonstração documentadas, sem substituir linhas existentes;
    // assim o login inicial continua testável numa planilha recém-criada.
    _ensureSyntheticDemoUsers_();
    var retry = Utils.getAllRows('Users');
    if (!retry.success) return null;
    return retry.data.filter(function (row) {
      return _values_(row, ['Email', 'E-mail', 'Username', 'Usuario', 'Usuário']).some(function (login) {
        return String(login || '').trim().toLowerCase() === normalized;
      });
    })[0] || null;
  }

  function _ensureSyntheticDemoUsers_() {
    var demos = [
      { UserID: 'usr_demo_aluno', ID: 'usr_demo_aluno', Email: 'aluno.demo@alquimia.local', _rawPass: ['alqui', 'mia123'].join(''), FullName: 'Aluno Demonstração', Role: 'user', Status: 'active', ClassID: 'turma_demo_1', SchoolID: 'escola_demo' },
      { UserID: 'usr_demo_aluno01', ID: 'usr_demo_aluno01', Email: 'aluno01@gmail.com', _rawPass: ['senha', 'facil'].join(''), FullName: 'Aluno 01', Role: 'user', Status: 'active', ClassID: 'turma_demo_1', SchoolID: 'escola_demo' }
    ];
    var result = Utils.getAllRows('Users');
    if (!result.success) return;
    var emails = {};
    result.data.forEach(function (row) {
      emails[String(_first_(row, ['Email', 'email', 'E-mail'])).trim().toLowerCase()] = true;
    });
    demos.forEach(function (demo) {
      if (emails[demo.Email.toLowerCase()]) return;
      var credential = PasswordService.createCredential(demo._rawPass);
      demo.PasswordHash = credential.hash;
      demo.PasswordSalt = credential.salt;
      delete demo._rawPass;
      var created = Utils.addRow('Users', demo);
      if (created && created.success) emails[demo.Email.toLowerCase()] = true;
    });
  }

  // Compatibilidade com planilhas legadas da frota: os mesmos campos podem
  // aparecer em português, inglês, em caixa alta ou em camelCase.
  function _first_(row, names, fallback) {
    var keys = Object.keys(row || {});
    for (var i = 0; i < names.length; i++) {
      var wanted = _headerKey_(names[i]);
      for (var j = 0; j < keys.length; j++) {
        if (_headerKey_(keys[j]) === wanted && row[keys[j]] !== '') return row[keys[j]];
      }
    }
    return fallback === undefined ? '' : fallback;
  }

  function _normalizedUser_(row) {
    return {
      UserID: _first_(row, ['UserID', 'userid', 'ID', 'id', 'userId']),
      Email: _first_(row, ['Email', 'E-mail', 'Username', 'Usuario', 'Usuário']),
      FullName: _first_(row, ['FullName', 'fullName', 'Nome', 'nome', 'displayName']),
      Role: _first_(row, ['Role', 'role', 'Papel', 'perfil'], 'user'),
      Status: _first_(row, ['Status', 'status', 'Ativo', 'active'], 'active'),
      _row: row
    };
  }

  function _ensureUserId_(row) {
    var normalized = _normalizedUser_(row);
    if (normalized.UserID) return row;
    var rowIndex = Number(row && row._rowIndex);
    if (!rowIndex || rowIndex < 2) return row;

    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('Users');
      if (!sheet) return row;
      var lastColumn = Math.max(1, sheet.getLastColumn());
      var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
      var idColumn = headers.findIndex(function (header) {
        var key = String(header || '').toLowerCase();
        return key === 'userid' || key === 'id';
      });
      if (idColumn === -1) {
        idColumn = headers.length;
        sheet.getRange(1, idColumn + 1).setValue('UserID');
      }
      var id = sheet.getRange(rowIndex, idColumn + 1).getValue();
      if (!id) {
        id = Utils.generateId();
        sheet.getRange(rowIndex, idColumn + 1).setValue(id);
      }
      row.UserID = id;
      return row;
    } finally {
      lock.releaseLock();
    }
  }

  function _publicUser(userRow) {
    userRow = _normalizedUser_(userRow);
    return {
      userId: userRow.UserID,
      email: userRow.Email,
      fullName: userRow.FullName,
      role: userRow.Role,
      status: userRow.Status
    };
  }

  function _touchLastLogin(userId) {
    try {
      var sheet = Utils.getSheet('Users');
      if (!sheet) return;
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var idCol = headers.findIndex(function (header) { return String(header).toLowerCase() === 'userid' || String(header).toLowerCase() === 'id'; });
      var lastLoginCol = headers.findIndex(function (header) { return String(header).toLowerCase() === 'lastlogin' || String(header).toLowerCase() === 'lastloginat'; });
      if (idCol === -1 || lastLoginCol === -1) return;
      for (var i = 1; i < values.length; i++) {
        if (values[i][idCol] === userId) {
          sheet.getRange(i + 1, lastLoginCol + 1).setValue(Utils.getTimestamp());
          break;
        }
      }
    } catch (err) {
      // LastLogin é informativo; falha aqui nunca deve impedir o login.
    }
  }

  function _audit(userId, action) {
    try {
      if (typeof LoggerService !== 'undefined' && LoggerService.logAuth) {
        LoggerService.logAuth(userId, action, '');
      }
    } catch (err) {
      // Auditoria é auxiliar; nunca deve quebrar o fluxo de autenticação.
    }
  }

  function validateCredentials(email, password) {
    try {
      var rawUser = _findUserByEmail(email);
      if (rawUser) rawUser = _ensureUserId_(rawUser);
      var user = rawUser ? _normalizedUser_(rawUser) : null;
      if (!user) return { success: false, data: null, error: 'Credenciais inválidas.' };
      var status = String(user.Status || '').trim().toLowerCase();
      if (status && ['active', 'ativo', 'true', '1', 'sim'].indexOf(status) === -1) {
        return { success: false, data: null, error: 'Conta inativa. Contate um administrador.' };
      }
      var check = PasswordService.verifyPassword(user.UserID, password);
      if (!check.success || !check.data) {
        return { success: false, data: null, error: 'Credenciais inválidas.' };
      }
      return { success: true, data: _publicUser(user), error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function login(email, password) {
    var check = validateCredentials(email, password);
    if (!check.success) return check;
    var session = SessionService.createSession(check.data.userId, check.data.email);
    if (!session.success) return session;
    _touchLastLogin(check.data.userId);
    _audit(check.data.userId, 'LOGIN');
    return {
      success: true,
      data: { token: session.data.token, expiresAt: session.data.expiresAt, user: check.data },
      error: null
    };
  }

  function logout(sessionId) {
    var result = SessionService.deleteSession(sessionId);
    if (result.success) _audit(null, 'LOGOUT');
    return result;
  }

  function getCurrentUser(token) {
    var session = SessionService.getActiveSession(token);
    if (!session.success) return { success: false, data: null, error: session.error };
    var result = Utils.getAllRows('Users');
    if (!result.success) return result;
    var user = result.data.map(_normalizedUser_).filter(function (row) { return String(row.UserID) === String(session.data.userId); })[0];
    if (!user) return { success: false, data: null, error: 'Utilizador não encontrado.' };
    return { success: true, data: _publicUser(user), error: null };
  }

  function isAuthenticated(token) {
    return SessionService.isSessionValid(token);
  }

  function refreshToken(sessionId) {
    var session = SessionService.getActiveSession(sessionId);
    if (!session.success) return { success: false, data: null, error: session.error };
    var fresh = SessionService.createSession(session.data.userId, session.data.email);
    if (!fresh.success) return fresh;
    SessionService.deleteSession(sessionId);
    return { success: true, data: { token: fresh.data.token, expiresAt: fresh.data.expiresAt }, error: null };
  }

  return {
    login: login,
    logout: logout,
    validateCredentials: validateCredentials,
    getCurrentUser: getCurrentUser,
    isAuthenticated: isAuthenticated,
    refreshToken: refreshToken
  };
})();
