/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — PermissionService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Controle de acesso baseado em roles (RBAC). Três níveis: admin (total),
 *   user (simulador + perfil), guest (público).
 *
 * FUNCIONALIDADES:
 *   • hasRole(userId, role) — Verifica papel.
 *   • isAdmin(userId) — Verifica se é admin.
 *   • canAccess(userId, resource, action) — Verifica permissão por prefixo
 *     de rota (ver MATRIZ) e ação ('read'/'write'/'delete'; guest só lê).
 *   • getAccessibleRoutes(role) — Lista de prefixos de rota permitidos —
 *     usada para montar menus adaptativos (ex.: header.html), não para
 *     bloquear requisições.
 *   • requireRole(userId, role) — Guard clause reutilizável por outros
 *     serviços: `var chk = PermissionService.requireRole(userId,'admin');
 *     if (!chk.data) return chk;`. Assinatura estendida com userId (ver
 *     NOTA DE ARQUITETURA) — o stub original previa 1 argumento, mas
 *     verificar um papel sem saber de qual utilizador não é possível neste
 *     ambiente sem sessão ambiente (ver SessionService.gs).
 *   • promoteToAdmin(userId) — Eleva a admin.
 *   • demoteToUser(userId) — Rebaixa para user.
 *
 * NOTA DE ARQUITETURA (relação com Code.gs):
 *   Code.gs mantém seu PRÓPRIO whitelist completo (PAGE_REGISTRY, 45 rotas)
 *   para gating de doGet — isso foi deliberado (ver "Degradação controlada"
 *   no cabeçalho de Code.gs) para que o roteamento funcionasse mesmo antes
 *   de este serviço existir. getAccessibleRoutes() aqui é um MATRIZ mais
 *   simples, por PREFIXO, pensado para construir menus de navegação
 *   dinâmicos — não substitui nem duplica a whitelist de segurança de
 *   Code.gs. As duas fontes servem propósitos diferentes por design.
 *
 * MATRIZ (por prefixo de rota):
 *   admin → qualquer rota CRUD + admin_* (acesso irrestrito)
 *   user  → laboratory, cauldron, potion_builder, scenario_*, result_*,
 *           vocation_*, domain_map, profile, settings, theme_settings,
 *           welcome, onboarding, leaderboard, achievement,
 *           notification_panel, search_results, help
 *   guest → login, register, forgot_password, help, error_page, index
 *           (apenas ação 'read')
 *
 * INTEGRAÇÕES:
 *   • Utils — acesso em lote à aba Users (coluna Role).
 *   • LoggerService.logCRUD() — registro de mudanças de papel (opcional).
 *
 * PADRÕES:
 *   Batch read — Utils.getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const PermissionService = (function () {

  var USER_PREFIXES = [
    'laboratory', 'cauldron', 'potion_builder', 'scenario_', 'result_',
    'vocation_', 'domain_map', 'profile', 'settings', 'theme_settings',
    'welcome', 'onboarding', 'leaderboard', 'achievement',
    'notification_panel', 'search_results', 'help'
  ];
  var GUEST_PREFIXES = ['login', 'register', 'forgot_password', 'help', 'error_page', 'index'];

  function _getUserRow(userId) {
    var result = Utils.getAllRows('Users');
    if (!result.success) return null;
    return result.data.filter(function (row) { return row.UserID === userId; })[0] || null;
  }

  function _getRole(userId) {
    if (!userId) return 'guest';
    var user = _getUserRow(userId);
    return (user && user.Role) ? String(user.Role).toLowerCase() : 'guest';
  }

  function _matchesPrefix(resource, prefixes) {
    var name = String(resource || '').toLowerCase();
    return prefixes.some(function (prefix) { return name.indexOf(prefix) === 0; });
  }

  function hasRole(userId, role) {
    return { success: true, data: _getRole(userId) === String(role || '').toLowerCase(), error: null };
  }

  function isAdmin(userId) {
    return hasRole(userId, 'admin');
  }

  function canAccess(userId, resource, action) {
    var role = _getRole(userId);
    var act = String(action || 'read').toLowerCase();

    if (role === 'admin') return { success: true, data: true, error: null };

    if (role === 'user') {
      return { success: true, data: _matchesPrefix(resource, USER_PREFIXES), error: null };
    }

    // guest: só leitura, e apenas nas rotas públicas.
    var isGuestRoute = _matchesPrefix(resource, GUEST_PREFIXES);
    return { success: true, data: isGuestRoute && act === 'read', error: null };
  }

  function getAccessibleRoutes(role) {
    var normalized = String(role || 'guest').toLowerCase();
    if (normalized === 'admin') return { success: true, data: ['*'], error: null };
    if (normalized === 'user') return { success: true, data: USER_PREFIXES.slice(), error: null };
    return { success: true, data: GUEST_PREFIXES.slice(), error: null };
  }

  function requireRole(userId, role) {
    var check = String(role).toLowerCase() === 'admin' ? isAdmin(userId) : hasRole(userId, role);
    if (!check.data) {
      return { success: false, data: false, error: 'Acesso negado: papel exigido "' + role + '".' };
    }
    return { success: true, data: true, error: null };
  }

  function _setRole(userId, newRole) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('Users');
      if (!sheet) return { success: false, data: null, error: 'Aba Users não encontrada.' };
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var idCol = headers.indexOf('UserID');
      var roleCol = headers.indexOf('Role');
      if (idCol === -1 || roleCol === -1) return { success: false, data: null, error: 'Cabeçalho da aba Users inválido.' };
      var rowNumber = -1;
      for (var i = 1; i < values.length; i++) {
        if (values[i][idCol] === userId) { rowNumber = i + 1; break; }
      }
      if (rowNumber === -1) return { success: false, data: null, error: 'Utilizador não encontrado.' };
      sheet.getRange(rowNumber, roleCol + 1).setValue(newRole);
      try {
        if (typeof LoggerService !== 'undefined' && LoggerService.logCRUD) {
          LoggerService.logCRUD('Users', 'ROLE_CHANGE', userId, 'system');
        }
      } catch (err) {
        // Auditoria é auxiliar.
      }
      return { success: true, data: { userId: userId, role: newRole }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function promoteToAdmin(userId) {
    return _setRole(userId, 'admin');
  }

  function demoteToUser(userId) {
    return _setRole(userId, 'user');
  }

  return {
    hasRole: hasRole,
    isAdmin: isAdmin,
    canAccess: canAccess,
    getAccessibleRoutes: getAccessibleRoutes,
    requireRole: requireRole,
    promoteToAdmin: promoteToAdmin,
    demoteToUser: demoteToUser
  };
})();
