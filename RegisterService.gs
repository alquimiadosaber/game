/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — RegisterService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Serviço de registro de novos utilizadores. Cria conta na aba Users com
 *   digest salgado, valida unicidade de e-mail e aplica
 *   perfil padrão.
 *   ÚNICO DESVIO REMANESCENTE da especificação original: força mínima de
 *   senha 6 → 8 caracteres, para coincidir com
 *   PasswordService.MIN_PASSWORD_LENGTH (duas constantes locais que devem
 *   permanecer sincronizadas; ver a constante abaixo).
 *
 * FUNCIONALIDADES:
 *   • register(email, password, fullName) — Cria novo utilizador (role=user).
 *   • validateEmail(email) — Verifica se e-mail já existe.
 *   • validatePassword(password) — Valida força (mín. 8 caracteres).
 *   • getDefaultProfile() — Retorna perfil padrão (role/status iniciais).
 *   • registerAdmin(email, password, fullName) — Cria administrador
 *     (role=admin). AVISO DE SEGURANÇA: NUNCA exponha esta função como
 *     bridge pública de google.script.run sem que o chamador já esteja
 *     autenticado como admin — do contrário qualquer visitante poderia
 *     se autopromover.
 *
 * REUTILIZAÇÃO DE PasswordService:
 *   A senha inicial é encaminhada por PasswordService.createCredential()
 *   antes de gravar a linha; o segredo nunca chega à planilha.
 *
 * INTEGRAÇÕES:
 *   • Utils — acesso em lote à aba Users.
 *   • PasswordService.createCredential() — gera digest e salt exclusivos.
 *   • LoggerService.logCRUD() — registro de criação de conta (opcional).
 *
 * PADRÕES:
 *   Batch read — Utils.getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.3.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const RegisterService = (function () {

  // Deve permanecer igual a PasswordService.MIN_PASSWORD_LENGTH (constante
  // interna daquele módulo, não exportada) — ver nota na DESCRIÇÃO acima.
  var MIN_PASSWORD_LENGTH = 8;

  function _emailExists(email) {
    var result = Utils.getAllRows('Users');
    if (!result.success) return false;
    var normalized = String(email || '').trim().toLowerCase();
    return result.data.some(function (row) {
      return String(row.Email || '').trim().toLowerCase() === normalized;
    });
  }

  function validateEmail(email) {
    var normalized = String(email || '').trim();
    var validFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
    if (!validFormat) return { success: true, data: { available: false, reason: 'Formato de e-mail inválido.' }, error: null };
    var exists = _emailExists(normalized);
    return { success: true, data: { available: !exists, reason: exists ? 'E-mail já cadastrado.' : null }, error: null };
  }

  function validatePassword(password) {
    var valid = typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH;
    return {
      success: true,
      data: { valid: valid, reason: valid ? null : ('Senha deve ter no mínimo ' + MIN_PASSWORD_LENGTH + ' caracteres.') },
      error: null
    };
  }

  function getDefaultProfile() {
    return { success: true, data: { role: 'user', status: 'active' }, error: null };
  }

  function _createUser(email, password, fullName, role) {
    var emailCheck = validateEmail(email);
    if (!emailCheck.data.available) {
      return { success: false, data: null, error: emailCheck.data.reason || 'E-mail indisponível.' };
    }
    var passCheck = validatePassword(password);
    if (!passCheck.data.valid) {
      return { success: false, data: null, error: passCheck.data.reason };
    }
    var name = String(fullName || '').trim();
    if (name.length < 2) {
      return { success: false, data: null, error: 'Nome completo é obrigatório.' };
    }

    var userId = Utils.generateId();
    var profile = getDefaultProfile().data;
    var credential = PasswordService.createCredential(password);
    var createResult = Utils.addRow('Users', {
      UserID: userId,
      Email: String(email).trim(),
      PasswordHash: credential.hash,
      PasswordSalt: credential.salt,
      PasswordUpdatedAt: '',
      FullName: name,
      Role: role || profile.role,
      Status: profile.status,
      CreatedAt: Utils.getTimestamp(),
      LastLogin: ''
    });
    if (!createResult.success) return createResult;

    try {
      if (typeof LoggerService !== 'undefined' && LoggerService.logCRUD) {
        LoggerService.logCRUD('Users', 'CREATE', userId, userId);
      }
    } catch (err) {
      // Auditoria é auxiliar.
    }

    return { success: true, data: { userId: userId, email: email, fullName: name, role: role || profile.role }, error: null };
  }

  function register(email, password, fullName) {
    return _createUser(email, password, fullName, 'user');
  }

  // AVISO DE SEGURANÇA: ver nota na DESCRIÇÃO — nunca expor diretamente ao
  // cliente sem verificação prévia de que o chamador já é admin.
  function registerAdmin(email, password, fullName) {
    return _createUser(email, password, fullName, 'admin');
  }

  return {
    register: register,
    validateEmail: validateEmail,
    validatePassword: validatePassword,
    getDefaultProfile: getDefaultProfile,
    registerAdmin: registerAdmin
  };
})();
