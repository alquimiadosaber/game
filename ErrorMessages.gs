/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — ErrorMessages.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Catálogo centralizado de mensagens de erro padronizadas. Fornece códigos
 *   únicos, mensagens consistentes e traduções para melhorar UX e debugging.
 *
 * BENEFÍCIOS:
 *   • Padronização — Mensagens consistentes em todo o projeto.
 *   • Debugging — Códigos únicos facilitam busca em logs.
 *   • Manutenibilidade — Alterações centralizadas (single source of truth).
 *   • Internacionalização — Preparado para múltiplos idiomas.
 *   • Documentação — Catálogo serve como referência de erros possíveis.
 *
 * FUNCIONALIDADES:
 *   • get(code) — Retorna mensagem por código.
 *   • format(code, params) — Mensagem com interpolação de parâmetros.
 *   • getAll() — Lista todos os códigos disponíveis.
 *   • getCategoryErrors(category) — Filtra por categoria.
 *   • exists(code) — Verifica se código existe.
 *
 * CONVENÇÃO DE CÓDIGOS:
 *   [CATEGORIA]_[NÚMERO]
 *   
 *   Categorias:
 *   - AUTH: Autenticação (001-099)
 *   - VALID: Validação (100-199)
 *   - DATA: Dados/CRUD (200-299)
 *   - PERM: Permissões (300-399)
 *   - CACHE: Cache (400-499)
 *   - SCORE: Pontuação (500-599)
 *   - CAULDRON: Caldeirão (600-699)
 *   - TRIGGER: Triggers (700-799)
 *   - SYSTEM: Sistema/Infraestrutura (800-899)
 *   - UNKNOWN: Erros não categorizados (900-999)
 *
 * PADRÕES:
 *   Immutable catalog — Catálogo é definido uma vez e não muda em runtime.
 *   Service result pattern — { success, data, error }.
 *   Template strings — Suporte a {param} para interpolação.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ErrorMessages = (function () {

  // ═══════════════════════════════════════════════════════════════════════════
  // CATÁLOGO DE MENSAGENS
  // ═══════════════════════════════════════════════════════════════════════════

  var MESSAGES = {
    // ─── AUTENTICAÇÃO (001-099) ───────────────────────────────────────────
    'AUTH_001': 'Credenciais inválidas. Verifique email e senha.',
    'AUTH_002': 'Sessão expirada. Por favor, faça login novamente.',
    'AUTH_003': 'Utilizador não encontrado.',
    'AUTH_004': 'Conta inativa. Contate um administrador.',
    'AUTH_005': 'Token de autenticação inválido.',
    'AUTH_006': 'Senha atual incorreta.',
    'AUTH_007': 'Email não encontrado no sistema.',
    'AUTH_008': 'Sessão não encontrada.',
    'AUTH_009': 'Falha ao criar sessão. Tente novamente.',
    'AUTH_010': 'Falha ao encerrar sessão.',

    // ─── VALIDAÇÃO (100-199) ──────────────────────────────────────────────
    'VALID_100': 'Campo obrigatório não preenchido: {field}',
    'VALID_101': 'Formato de email inválido.',
    'VALID_102': 'Senha deve ter no mínimo {min} caracteres.',
    'VALID_103': 'Senhas não coincidem.',
    'VALID_104': 'Valor inválido para o campo: {field}',
    'VALID_105': 'Data inválida: {date}',
    'VALID_106': 'Valor deve estar entre {min} e {max}.',
    'VALID_107': 'Texto excede limite de {max} caracteres.',
    'VALID_108': 'Formato inválido. Esperado: {format}',
    'VALID_109': 'Valor numérico esperado.',
    'VALID_110': 'Email já cadastrado.',
    'VALID_111': 'Proporção inválida. A soma deve ser 100%.',
    'VALID_112': 'Componente inválido: {component}',
    'VALID_113': 'Quantidade deve estar entre 0 e 100.',
    'VALID_114': 'Cenário inválido.',
    'VALID_115': 'Dificuldade inválida. Use: easy, medium, hard, expert.',

    // ─── DADOS/CRUD (200-299) ─────────────────────────────────────────────
    'DATA_200': 'Registro não encontrado: {entity}',
    'DATA_201': 'Erro ao criar registro: {entity}',
    'DATA_202': 'Erro ao atualizar registro: {entity}',
    'DATA_203': 'Erro ao excluir registro: {entity}',
    'DATA_204': 'Registro já existe: {entity}',
    'DATA_205': 'Aba não encontrada: {sheet}',
    'DATA_206': 'Coluna não encontrada: {column}',
    'DATA_207': 'Dados inconsistentes na planilha.',
    'DATA_208': 'Falha ao acessar planilha.',
    'DATA_209': 'ID inválido: {id}',
    'DATA_210': 'Nenhum registro encontrado.',
    'DATA_211': 'Limite de registros excedido.',
    'DATA_212': 'Operação em lote falhou parcialmente.',

    // ─── PERMISSÕES (300-399) ─────────────────────────────────────────────
    'PERM_300': 'Acesso negado. Permissão insuficiente.',
    'PERM_301': 'Operação requer papel de administrador.',
    'PERM_302': 'Operação requer papel: {role}',
    'PERM_303': 'Recurso protegido. Autenticação necessária.',
    'PERM_304': 'Você não tem permissão para acessar este recurso.',
    'PERM_305': 'Operação não permitida para este tipo de conta.',
    'PERM_306': 'Limite de tentativas excedido. Conta bloqueada temporariamente.',

    // ─── CACHE (400-499) ──────────────────────────────────────────────────
    'CACHE_400': 'Item não encontrado no cache.',
    'CACHE_401': 'Erro ao gravar no cache.',
    'CACHE_402': 'Cache excedeu limite de tamanho.',
    'CACHE_403': 'Chave de cache inválida.',
    'CACHE_404': 'Erro ao limpar cache.',
    'CACHE_405': 'Cache expirado.',
    'CACHE_406': 'Limite de cache atingido ({max} itens).',

    // ─── PONTUAÇÃO (500-599) ──────────────────────────────────────────────
    'SCORE_500': 'Erro ao calcular pontuação.',
    'SCORE_501': 'Parâmetros de cálculo inválidos.',
    'SCORE_502': 'Dificuldade do cenário não encontrada.',
    'SCORE_503': 'Score inválido: deve estar entre 0 e 100.',
    'SCORE_504': 'Histórico insuficiente para cálculo TRI.',
    'SCORE_505': 'Erro ao calcular XP.',

    // ─── CALDEIRÃO (600-699) ──────────────────────────────────────────────
    'CAULDRON_600': 'Caldeirão não está pronto. Complete a mistura primeiro.',
    'CAULDRON_601': 'Mistura inválida. FIL + PSI + IA deve somar 100%.',
    'CAULDRON_602': 'Componente inválido. Use: FIL, PSI ou IA.',
    'CAULDRON_603': 'Quantidade deve estar entre 0 e 100.',
    'CAULDRON_604': 'Caldeirão já está em uso.',
    'CAULDRON_605': 'Cenário não foi inicializado.',
    'CAULDRON_606': 'Erro ao processar poção.',
    'CAULDRON_607': 'Estado do caldeirão corrompido. Resete e tente novamente.',

    // ─── TRIGGERS (700-799) ───────────────────────────────────────────────
    'TRIGGER_700': 'Trigger não encontrado.',
    'TRIGGER_701': 'Limite de triggers atingido ({max} máximo).',
    'TRIGGER_702': 'Nome de função inválido para trigger.',
    'TRIGGER_703': 'Hora inválida. Use valores entre 0 e 23.',
    'TRIGGER_704': 'Dia da semana inválido.',
    'TRIGGER_705': 'Erro ao criar trigger.',
    'TRIGGER_706': 'Erro ao remover trigger.',
    'TRIGGER_707': 'Quota de triggers excedida (90 min/dia).',

    // ─── SISTEMA (800-899) ────────────────────────────────────────────────
    'SYSTEM_800': 'Erro interno do sistema. Tente novamente.',
    'SYSTEM_801': 'Serviço temporariamente indisponível.',
    'SYSTEM_802': 'Timeout na operação. Tente novamente.',
    'SYSTEM_803': 'Lock de concorrência não pôde ser obtido.',
    'SYSTEM_804': 'Configuração ausente: {config}',
    'SYSTEM_805': 'Dependência não disponível: {service}',
    'SYSTEM_806': 'Formato de dados incompatível.',
    'SYSTEM_807': 'Operação cancelada pelo sistema.',
    'SYSTEM_808': 'Memória insuficiente.',
    'SYSTEM_809': 'Limite de quota do Google Apps Script atingido.',

    // ─── DESCONHECIDO (900-999) ───────────────────────────────────────────
    'UNKNOWN_900': 'Erro desconhecido. Código: {code}',
    'UNKNOWN_901': 'Operação indisponível nesta versão.',
    'UNKNOWN_902': 'Parâmetro inesperado: {param}'
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÕES PÚBLICAS
  // ═══════════════════════════════════════════════════════════════════════════

  function exists(code) {
    return MESSAGES.hasOwnProperty(String(code).toUpperCase());
  }

  function get(code) {
    try {
      var normalizedCode = String(code).toUpperCase();
      
      if (!exists(normalizedCode)) {
        return {
          success: false,
          data: null,
          error: 'Código de erro não encontrado: ' + code
        };
      }
      
      return {
        success: true,
        data: {
          code: normalizedCode,
          message: MESSAGES[normalizedCode]
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function format(code, params) {
    try {
      var result = get(code);
      if (!result.success) return result;
      
      var message = result.data.message;
      
      // Substitui {param} pelos valores fornecidos
      if (params && typeof params === 'object') {
        Object.keys(params).forEach(function(key) {
          var placeholder = '{' + key + '}';
          message = message.replace(new RegExp(placeholder, 'g'), params[key]);
        });
      }
      
      return {
        success: true,
        data: {
          code: result.data.code,
          message: message
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getAll() {
    try {
      var all = [];
      
      Object.keys(MESSAGES).forEach(function(code) {
        all.push({
          code: code,
          category: code.split('_')[0],
          message: MESSAGES[code]
        });
      });
      
      return { success: true, data: all, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getCategoryErrors(category) {
    try {
      var normalized = String(category).toUpperCase();
      var filtered = [];
      
      Object.keys(MESSAGES).forEach(function(code) {
        if (code.startsWith(normalized + '_')) {
          filtered.push({
            code: code,
            category: normalized,
            message: MESSAGES[code]
          });
        }
      });
      
      if (filtered.length === 0) {
        return {
          success: false,
          data: [],
          error: 'Categoria não encontrada: ' + category
        };
      }
      
      return { success: true, data: filtered, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function buildError(code, params) {
    var formatted = format(code, params);
    
    if (!formatted.success) {
      return {
        success: false,
        data: null,
        error: 'Erro desconhecido: ' + code
      };
    }
    
    return {
      success: false,
      data: null,
      error: '[' + formatted.data.code + '] ' + formatted.data.message
    };
  }

  function getCategories() {
    return {
      success: true,
      data: [
        { code: 'AUTH', name: 'Autenticação', range: '001-099' },
        { code: 'VALID', name: 'Validação', range: '100-199' },
        { code: 'DATA', name: 'Dados/CRUD', range: '200-299' },
        { code: 'PERM', name: 'Permissões', range: '300-399' },
        { code: 'CACHE', name: 'Cache', range: '400-499' },
        { code: 'SCORE', name: 'Pontuação', range: '500-599' },
        { code: 'CAULDRON', name: 'Caldeirão', range: '600-699' },
        { code: 'TRIGGER', name: 'Triggers', range: '700-799' },
        { code: 'SYSTEM', name: 'Sistema', range: '800-899' },
        { code: 'UNKNOWN', name: 'Desconhecido', range: '900-999' }
      ],
      error: null
    };
  }

  return {
    get: get,
    format: format,
    getAll: getAll,
    getCategoryErrors: getCategoryErrors,
    exists: exists,
    buildError: buildError,
    getCategories: getCategories
  };
})();

// ═══════════════════════════════════════════════════════════════════════════
// EXEMPLO DE USO
// ═══════════════════════════════════════════════════════════════════════════
/*

// Uso básico:
var error = ErrorMessages.get('AUTH_001');
// Retorna: { success: true, data: { code: 'AUTH_001', message: 'Credenciais inválidas...' } }

// Com parâmetros:
var error = ErrorMessages.format('VALID_100', { field: 'Email' });
// Retorna: { success: true, data: { code: 'VALID_100', message: 'Campo obrigatório não preenchido: Email' } }

// Construir erro completo:
var result = ErrorMessages.buildError('AUTH_001');
// Retorna: { success: false, data: null, error: '[AUTH_001] Credenciais inválidas...' }

// Listar por categoria:
var authErrors = ErrorMessages.getCategoryErrors('AUTH');
// Retorna: { success: true, data: [{ code: 'AUTH_001', ... }, { code: 'AUTH_002', ... }] }

// Uso em serviços:
function login(email, password) {
  if (!email || !password) {
    return ErrorMessages.buildError('VALID_100', { field: 'Email/Senha' });
  }
  // ... lógica de login
}

*/
