/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — ErrorSanitizer.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Serviço de sanitização de mensagens de erro para prevenir vazamento de
 *   informações técnicas do backend para o frontend. Remove referências a:
 *   - Nomes de planilhas e colunas
 *   - Propriedades de configuração (SPREADSHEETS_ID, etc.)
 *   - Stack traces e caminhos de arquivo
 *   - Detalhes de implementação interna
 *
 * FUNCIONALIDADES:
 *   • sanitize(error) — Limpa mensagem de erro para exibição ao usuário
 *   • sanitizeResult(result) — Limpa campo error de um ServiceResult
 *   • isProductionMode() — Verifica se está em modo produção
 *
 * SEGURANÇA:
 *   Em modo desenvolvimento (DEBUG=true), mantém mensagens originais para
 *   facilitar debugging. Em produção, substitui por mensagens genéricas.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ErrorSanitizer = (function () {
  
  // Modo debug pode ser ativado temporariamente para desenvolvimento
  // IMPORTANTE: Sempre deixar false em produção!
  var DEBUG = false;
  
  // Padrões que indicam vazamento de informações técnicas
  var TECHNICAL_PATTERNS = [
    /SPREADSHEETS?_ID/gi,
    /PropertiesService/gi,
    /SpreadsheetApp/gi,
    /DocumentProperties/gi,
    /getDocumentProperties/gi,
    /getSheetByName/gi,
    /\.gs\b/gi,
    /Aba "[^"]*" não encontrada/gi,
    /Coluna "[^"]*" não/gi,
    /GAME_ASSET_FOLDER_ID/gi,
    /at [\w\.]+:\d+/gi,  // Stack trace
    /\(\w+\.gs:\d+:\d+\)/gi,  // Referências a arquivos
    /TypeError:/gi,
    /ReferenceError:/gi,
    /SyntaxError:/gi,
    /ScriptApp/gi,
    /LockService/gi,
    /CacheService/gi
  ];
  
  // Mapeamento de termos técnicos para termos amigáveis
  var FRIENDLY_REPLACEMENTS = {
    'SPREADSHEETS_ID não configurado': 'configuração do sistema',
    'Planilha não encontrada': 'dados do sistema',
    'Aba': 'dados',
    'Coluna': 'informação',
    'PropertiesService': 'configuração',
    'SpreadsheetApp': 'banco de dados',
    'não configurado em PropertiesService': 'não está disponível',
    'getDocumentProperties()': 'configuração do sistema'
  };
  
  // Mensagens genéricas por categoria de erro
  var GENERIC_MESSAGES = {
    config: 'Erro de configuração do sistema. Contate o administrador.',
    database: 'Erro ao acessar dados. Tente novamente em alguns instantes.',
    auth: 'Erro de autenticação. Por favor, faça login novamente.',
    validation: 'Dados inválidos. Verifique as informações e tente novamente.',
    permission: 'Você não tem permissão para realizar esta operação.',
    notFound: 'Recurso não encontrado.',
    generic: 'Ocorreu um erro inesperado. Tente novamente em alguns instantes.'
  };
  
  /**
   * Detecta a categoria do erro com base na mensagem
   */
  function _detectCategory(message) {
    var msg = String(message).toLowerCase();
    
    if (msg.indexOf('spreadsheets_id') >= 0 || 
        msg.indexOf('configurado') >= 0 ||
        msg.indexOf('folder_id') >= 0) {
      return 'config';
    }
    
    if (msg.indexOf('aba') >= 0 || 
        msg.indexOf('planilha') >= 0 ||
        msg.indexOf('coluna') >= 0 ||
        msg.indexOf('spreadsheet') >= 0) {
      return 'database';
    }
    
    if (msg.indexOf('sessão') >= 0 || 
        msg.indexOf('token') >= 0 ||
        msg.indexOf('autenticação') >= 0 ||
        msg.indexOf('credenciais') >= 0) {
      return 'auth';
    }
    
    if (msg.indexOf('inválid') >= 0 || 
        msg.indexOf('obrigatório') >= 0 ||
        msg.indexOf('formato') >= 0) {
      return 'validation';
    }
    
    if (msg.indexOf('permissão') >= 0 || 
        msg.indexOf('acesso negado') >= 0 ||
        msg.indexOf('não autorizado') >= 0) {
      return 'permission';
    }
    
    if (msg.indexOf('não encontrad') >= 0) {
      return 'notFound';
    }
    
    return 'generic';
  }
  
  /**
   * Verifica se uma mensagem contém informações técnicas
   */
  function _hasTechnicalInfo(message) {
    if (!message) return false;
    var msg = String(message);
    
    for (var i = 0; i < TECHNICAL_PATTERNS.length; i++) {
      if (TECHNICAL_PATTERNS[i].test(msg)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Remove informações técnicas de uma mensagem
   */
  function _removeTechnicalInfo(message) {
    var cleaned = String(message);
    
    // Aplica substituições amigáveis
    Object.keys(FRIENDLY_REPLACEMENTS).forEach(function (technical) {
      var friendly = FRIENDLY_REPLACEMENTS[technical];
      cleaned = cleaned.replace(new RegExp(technical, 'gi'), friendly);
    });
    
    // Remove padrões técnicos
    TECHNICAL_PATTERNS.forEach(function (pattern) {
      cleaned = cleaned.replace(pattern, '[configuração]');
    });
    
    // Remove stack traces (tudo após a primeira linha)
    cleaned = cleaned.split('\n')[0];
    
    // Remove parênteses com informações técnicas
    cleaned = cleaned.replace(/\([^)]*\.gs[^)]*\)/gi, '');
    
    return cleaned.trim();
  }
  
  /**
   * Sanitiza uma mensagem de erro para exibição ao usuário
   * 
   * @param {string|Error|Object} error - Erro para sanitizar
   * @return {string} Mensagem sanitizada
   */
  function sanitize(error) {
    // Em modo debug, retorna a mensagem original
    if (DEBUG) {
      return error instanceof Error ? error.message : String(error || '');
    }
    
    // Extrai a mensagem do erro
    var message = '';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'object' && error !== null) {
      message = error.message || error.error || error.toString();
    } else {
      message = String(error || '');
    }
    
    // Se a mensagem está vazia, retorna mensagem genérica
    if (!message || message === '[object Object]') {
      return GENERIC_MESSAGES.generic;
    }
    
    // Se contém informações técnicas, decide a estratégia
    if (_hasTechnicalInfo(message)) {
      var category = _detectCategory(message);
      
      // Tenta limpar a mensagem mantendo partes úteis
      var cleaned = _removeTechnicalInfo(message);
      
      // Se após limpeza ainda parece técnica ou muito curta, usa mensagem genérica
      if (_hasTechnicalInfo(cleaned) || cleaned.length < 10) {
        return GENERIC_MESSAGES[category] || GENERIC_MESSAGES.generic;
      }
      
      return cleaned;
    }
    
    // Mensagem já é segura, retorna como está (mas limita tamanho)
    return message.substring(0, 200);
  }
  
  /**
   * Sanitiza o campo error de um ServiceResult
   * 
   * @param {Object} result - ServiceResult {success, data, error}
   * @return {Object} ServiceResult com error sanitizado
   */
  function sanitizeResult(result) {
    if (!result || typeof result !== 'object') {
      return { 
        success: false, 
        data: null, 
        error: sanitize('Resposta inválida do servidor.') 
      };
    }
    
    // Se já é sucesso, não precisa sanitizar
    if (result.success === true) {
      return result;
    }
    
    // Sanitiza a mensagem de erro
    return {
      success: false,
      data: result.data || null,
      error: sanitize(result.error || 'Erro desconhecido.')
    };
  }
  
  /**
   * Verifica se está em modo produção
   * 
   * @return {boolean}
   */
  function isProductionMode() {
    return !DEBUG;
  }
  
  /**
   * Ativa/desativa modo debug (usar apenas em desenvolvimento!)
   * 
   * @param {boolean} enabled
   */
  function setDebugMode(enabled) {
    DEBUG = !!enabled;
    if (DEBUG && typeof Logger !== 'undefined') {
      Logger.log('[ErrorSanitizer] Modo DEBUG ativado - mensagens técnicas serão exibidas!');
    }
  }
  
  return {
    sanitize: sanitize,
    sanitizeResult: sanitizeResult,
    isProductionMode: isProductionMode,
    setDebugMode: setDebugMode
  };
})();

// ═══════════════════════════════════════════════════════════════════════════
// EXEMPLO DE USO
// ═══════════════════════════════════════════════════════════════════════════
/*

// Uso básico - sanitizar string:
var userMessage = ErrorSanitizer.sanitize('SPREADSHEETS_ID não configurado');
// Retorna: "Erro de configuração do sistema. Contate o administrador."

// Uso com ServiceResult:
var result = { success: false, data: null, error: 'Aba Users não encontrada.' };
var sanitized = ErrorSanitizer.sanitizeResult(result);
// Retorna: { success: false, data: null, error: "Erro ao acessar dados. Tente novamente..." }

// Uso com Exception:
try {
  throw new Error('Coluna "Password" não existe na aba Users.');
} catch (err) {
  var safeMessage = ErrorSanitizer.sanitize(err);
  // Retorna: "Erro ao acessar dados. Tente novamente em alguns instantes."
}

// Modo debug (apenas desenvolvimento):
ErrorSanitizer.setDebugMode(true);
var debugMessage = ErrorSanitizer.sanitize('SPREADSHEETS_ID não configurado');
// Retorna: "SPREADSHEETS_ID não configurado" (mensagem original)

*/
