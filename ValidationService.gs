/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — ValidationService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Validação de entrada no servidor. Regras de validação para todos os formulários e APIs antes da escrita na planilha.
 *
 * FUNCIONALIDADES:
 *   • validateEmail(email) — Valida formato de e-mail.
   • validatePassword(password) — Valida força da senha.
   • validateRegistration(email, password, name) — Valida registro.
   • validatePotion(fil, psi, ia) — Valida proporção da poção (soma exata de 100%).
   • validateScenario(data) — Valida dados de cenário.
   • validateVocation(data) — Valida dados de vocação.
   • sanitize(input) — Sanitiza contra injection.
 *
 * INTEGRAÇÕES:
 *   • SanitizeService — sanitização complementar.
   • LoggerService — registro de validações falhadas.
   • Regex — padrões de validação.
 * Server-side validation — validação redundante ao frontend.
   Whitelist approach — apenas caracteres permitidos.
   Fail-fast — erro no primeiro campo inválido.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ValidationService = (function () {

  var EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  var MIN_PASSWORD_LENGTH = 8;
  var MIN_NAME_LENGTH = 2;

  // Inputs de formulários chegam como texto, mas a API não deve aceitar
  // coerções implícitas como null/true/[] => 0/1. Mantemos o suporte a
  // números em texto e restringimos o formato à notação decimal.
  function _finiteNumber(value) {
    if (typeof value === 'number') {
      return isFinite(value) ? { valid: true, value: value } : { valid: false };
    }

    if (typeof value !== 'string') return { valid: false };

    var text = value.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
      return { valid: false };
    }

    var parsed = Number(text);
    return isFinite(parsed) ? { valid: true, value: parsed } : { valid: false };
  }

  function validateEmail(email) {
    try {
      var normalized = String(email || '').trim();
      
      if (!normalized) {
        return { success: false, data: false, error: 'E-mail é obrigatório.' };
      }
      
      if (!EMAIL_REGEX.test(normalized)) {
        return { success: false, data: false, error: 'Formato de e-mail inválido.' };
      }
      
      if (normalized.length > 254) {
        return { success: false, data: false, error: 'E-mail muito longo (máx. 254 caracteres).' };
      }
      
      return { success: true, data: true, error: null };
    } catch (err) {
      return { success: false, data: false, error: err.message };
    }
  }

  function validatePassword(password) {
    try {
      var pwd = String(password || '');
      
      if (!pwd) {
        return { success: false, data: false, error: 'Senha é obrigatória.' };
      }
      
      if (pwd.length < MIN_PASSWORD_LENGTH) {
        return { success: false, data: false, error: 'Senha deve ter no mínimo ' + MIN_PASSWORD_LENGTH + ' caracteres.' };
      }
      
      if (pwd.length > 128) {
        return { success: false, data: false, error: 'Senha muito longa (máx. 128 caracteres).' };
      }
      
      // Recomendações adicionais (não obrigatórias)
      var hasLetter = /[a-zA-Z]/.test(pwd);
      var hasNumber = /[0-9]/.test(pwd);
      
      var strength = 'weak';
      if (pwd.length >= 12 && hasLetter && hasNumber) {
        strength = 'strong';
      } else if (pwd.length >= 10 && (hasLetter || hasNumber)) {
        strength = 'medium';
      }
      
      return { success: true, data: { valid: true, strength: strength }, error: null };
    } catch (err) {
      return { success: false, data: false, error: err.message };
    }
  }

  function validateRegistration(email, password, name) {
    try {
      var emailResult = validateEmail(email);
      if (!emailResult.success || !emailResult.data) {
        return emailResult;
      }
      
      var passwordResult = validatePassword(password);
      if (!passwordResult.success || !passwordResult.data.valid) {
        return { success: false, data: false, error: passwordResult.error };
      }
      
      var normalized = String(name || '').trim();
      if (!normalized || normalized.length < MIN_NAME_LENGTH) {
        return { success: false, data: false, error: 'Nome deve ter no mínimo ' + MIN_NAME_LENGTH + ' caracteres.' };
      }
      
      if (normalized.length > 100) {
        return { success: false, data: false, error: 'Nome muito longo (máx. 100 caracteres).' };
      }
      
      return { success: true, data: true, error: null };
    } catch (err) {
      return { success: false, data: false, error: err.message };
    }
  }

  function validatePotion(fil, psi, ia) {
    try {
      var fResult = _finiteNumber(fil);
      var pResult = _finiteNumber(psi);
      var iResult = _finiteNumber(ia);

      if (!fResult.valid || !pResult.valid || !iResult.valid) {
        return { success: false, data: false, error: 'Proporções devem ser números válidos.' };
      }

      var f = fResult.value;
      var p = pResult.value;
      var i = iResult.value;
      
      if (f < 0 || p < 0 || i < 0) {
        return { success: false, data: false, error: 'Proporções devem ser não-negativas.' };
      }
      
      var total = f + p + i;
      if (total === 0) {
        return { success: false, data: false, error: 'Pelo menos uma dimensão deve ser maior que zero.' };
      }

      // A mistura epistemica e uma distribuicao percentual: sempre fecha em 100%.
      if (Math.abs(total - 100) > 0.0001) {
        return { success: false, data: false, error: 'A soma das proporções deve ser exatamente 100.' };
      }
      
      if (f > 100 || p > 100 || i > 100) {
        return { success: false, data: false, error: 'Cada dimensão deve ser no máximo 100.' };
      }
      
      return { success: true, data: { fil: f, psi: p, ia: i, total: total }, error: null };
    } catch (err) {
      return { success: false, data: false, error: err.message };
    }
  }

  function validateScenario(data) {
    try {
      if (!data || typeof data !== 'object') {
        return { success: false, data: false, error: 'Dados do cenário inválidos.' };
      }
      
      var title = String(data.title || '').trim();
      if (!title || title.length < 3) {
        return { success: false, data: false, error: 'Título deve ter no mínimo 3 caracteres.' };
      }
      
      if (title.length > 200) {
        return { success: false, data: false, error: 'Título muito longo (máx. 200 caracteres).' };
      }
      
      var description = String(data.description || '').trim();
      if (description && description.length > 1000) {
        return { success: false, data: false, error: 'Descrição muito longa (máx. 1000 caracteres).' };
      }
      
      var validDifficulties = ['easy', 'medium', 'hard', 'expert'];
      var difficulty = String(data.difficulty || 'medium').toLowerCase();
      if (validDifficulties.indexOf(difficulty) === -1) {
        return { success: false, data: false, error: 'Dificuldade inválida. Use: easy, medium, hard ou expert.' };
      }
      
      return { success: true, data: true, error: null };
    } catch (err) {
      return { success: false, data: false, error: err.message };
    }
  }

  function validateVocation(data) {
    try {
      if (!data || typeof data !== 'object') {
        return { success: false, data: false, error: 'Dados da vocação inválidos.' };
      }
      
      var title = String(data.title || '').trim();
      if (!title || title.length < 3) {
        return { success: false, data: false, error: 'Título deve ter no mínimo 3 caracteres.' };
      }
      
      if (title.length > 100) {
        return { success: false, data: false, error: 'Título muito longo (máx. 100 caracteres).' };
      }
      
      var validDomains = ['A', 'B', 'C', 'D', 'E', 'F'];
      var domain = String(data.domain || '').toUpperCase();
      if (validDomains.indexOf(domain) === -1) {
        return { success: false, data: false, error: 'Domínio inválido. Use: A, B, C, D, E ou F.' };
      }
      
      var formula = String(data.formula || '').trim();
      if (formula && !/^([A-Z]+\d+\s*)+$/.test(formula.toUpperCase())) {
        return { success: false, data: false, error: 'Fórmula inválida. Formato esperado: IA3 FIL2 PSI1' };
      }
      
      return { success: true, data: true, error: null };
    } catch (err) {
      return { success: false, data: false, error: err.message };
    }
  }

  function sanitize(input) {
    try {
      if (typeof SanitizeService !== 'undefined' && SanitizeService.cleanInput) {
        return SanitizeService.cleanInput(input);
      }
      
      // Fallback simples
      return { success: true, data: Utils.sanitizeString(input), error: null };
    } catch (err) {
      return { success: false, data: input, error: err.message };
    }
  }

  return {
    validateEmail: validateEmail,
    validatePassword: validatePassword,
    validateRegistration: validateRegistration,
    validatePotion: validatePotion,
    validateScenario: validateScenario,
    validateVocation: validateVocation,
    sanitize: sanitize
  };
})();
