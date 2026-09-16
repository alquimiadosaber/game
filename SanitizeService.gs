/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — SanitizeService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Sanitização contra XSS e injection. Limpeza de strings para prevenir Cross-Site Scripting e injeção de dados maliciosos.
 *
 * FUNCIONALIDADES:
 *   • sanitizeHTML(str) — Remove tags HTML perigosas.
   • sanitizeSQL(str) — Escapa caracteres especiais.
   • stripScripts(str) — Remove scripts inline.
   • escapeQuotes(str) — Escapa aspas.
   • sanitizeForSheet(str) — Sanitiza para planilha.
   • validateFileType(filename) — Valida tipo de arquivo.
   • cleanInput(str) — Limpeza geral de entrada.
 *
 * INTEGRAÇÕES:
 *   • HtmlService — contextual escaping nativo.
   • ValidationService — validação complementar.
   • LoggerService — registro de tentativas de injection.
 * Defense in depth — sanitização em múltiplas camadas.
   Contextual escaping — HTML Service aplica escape automático.
   Input whitelisting — apenas caracteres seguros.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const SanitizeService = (function () {

  var DANGEROUS_TAGS = /<\s*(script|iframe|object|embed|applet|meta|link|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi;
  var ALL_TAGS = /<[^>]*>/g;
  var ALLOWED_FILE_TYPES = ['csv', 'json', 'txt', 'pdf', 'xlsx', 'xls'];

  function sanitizeHTML(str) {
    try {
      if (str === null || str === undefined) {
        return { success: true, data: '', error: null };
      }
      
      var cleaned = String(str)
        .replace(DANGEROUS_TAGS, '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
      
      return { success: true, data: cleaned, error: null };
    } catch (err) {
      return { success: false, data: str, error: err.message };
    }
  }

  function stripScripts(str) {
    try {
      if (str === null || str === undefined) {
        return { success: true, data: '', error: null };
      }
      
      var cleaned = String(str)
        .replace(DANGEROUS_TAGS, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/on\w+\s*=\s*[^\s>]*/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/data:text\/html/gi, '');
      
      return { success: true, data: cleaned, error: null };
    } catch (err) {
      return { success: false, data: str, error: err.message };
    }
  }

  function sanitizeSQL(str) {
    try {
      // Google Apps Script não usa SQL diretamente, mas é útil para sanitização geral
      if (str === null || str === undefined) {
        return { success: true, data: '', error: null };
      }
      
      var cleaned = String(str)
        .replace(/'/g, "''")
        .replace(/;/g, '')
        .replace(/--/g, '')
        .replace(/\/\*/g, '')
        .replace(/\*\//g, '')
        .replace(/xp_/gi, '')
        .replace(/sp_/gi, '');
      
      return { success: true, data: cleaned, error: null };
    } catch (err) {
      return { success: false, data: str, error: err.message };
    }
  }

  function escapeQuotes(str) {
    try {
      if (str === null || str === undefined) {
        return { success: true, data: '', error: null };
      }
      
      var cleaned = String(str)
        .replace(/"/g, '\\"')
        .replace(/'/g, "\\'");
      
      return { success: true, data: cleaned, error: null };
    } catch (err) {
      return { success: false, data: str, error: err.message };
    }
  }

  function sanitizeForSheet(str) {
    try {
      if (str === null || str === undefined) {
        return { success: true, data: '', error: null };
      }
      
      // Remove caracteres de controle e fórmulas perigosas
      var cleaned = String(str)
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
        .replace(/^[=+\-@]/g, "'$&");
      
      // Limita comprimento
      if (cleaned.length > 50000) {
        cleaned = cleaned.substring(0, 50000) + '... [truncado]';
      }
      
      return { success: true, data: cleaned, error: null };
    } catch (err) {
      return { success: false, data: str, error: err.message };
    }
  }

  function validateFileType(filename) {
    try {
      if (!filename || typeof filename !== 'string') {
        return { success: false, data: false, error: 'Nome de arquivo inválido.' };
      }
      
      var parts = filename.split('.');
      if (parts.length < 2) {
        return { success: false, data: false, error: 'Arquivo sem extensão.' };
      }
      
      var extension = parts[parts.length - 1].toLowerCase();
      
      if (ALLOWED_FILE_TYPES.indexOf(extension) === -1) {
        return { 
          success: false, 
          data: false, 
          error: 'Tipo de arquivo não permitido. Tipos permitidos: ' + ALLOWED_FILE_TYPES.join(', ') 
        };
      }
      
      return { success: true, data: { valid: true, extension: extension }, error: null };
    } catch (err) {
      return { success: false, data: false, error: err.message };
    }
  }

  function cleanInput(str) {
    try {
      if (str === null || str === undefined) {
        return { success: true, data: '', error: null };
      }
      
      // Pipeline de limpeza
      var cleaned = String(str);
      
      // Remove scripts
      var scriptResult = stripScripts(cleaned);
      if (scriptResult.success) {
        cleaned = scriptResult.data;
      }
      
      // Sanitiza HTML
      var htmlResult = sanitizeHTML(cleaned);
      if (htmlResult.success) {
        cleaned = htmlResult.data;
      }
      
      // Remove whitespace excessivo
      cleaned = cleaned
        .replace(/\s+/g, ' ')
        .trim();
      
      // Log suspeitas de injection
      if (str.indexOf('<script') !== -1 || 
          str.indexOf('javascript:') !== -1 || 
          str.indexOf('onerror=') !== -1) {
        try {
          if (typeof LoggerService !== 'undefined' && LoggerService.log) {
            LoggerService.log('SECURITY', 'system', {
              event: 'INJECTION_ATTEMPT',
              originalInput: str.substring(0, 200)
            });
          }
        } catch (logErr) {
          // Log é auxiliar
        }
      }
      
      return { success: true, data: cleaned, error: null };
    } catch (err) {
      return { success: false, data: str, error: err.message };
    }
  }

  return {
    sanitizeHTML: sanitizeHTML,
    sanitizeSQL: sanitizeSQL,
    stripScripts: stripScripts,
    escapeQuotes: escapeQuotes,
    sanitizeForSheet: sanitizeForSheet,
    validateFileType: validateFileType,
    cleanInput: cleanInput
  };
})();
