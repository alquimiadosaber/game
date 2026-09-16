/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — Code.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Ponto de entrada principal do web app. Contém doGet(e), que atua como
 *   controlador de roteamento, despachando requisições HTTP para os
 *   templates HTML corretos conforme a rota (?page=) solicitada, aplicando
 *   controlo de acesso (guest/user/admin). Define constantes globais.
 *
 * FUNCIONALIDADES:
 *   • doGet(e) — Recebe requisições GET, valida a rota contra PAGE_REGISTRY
 *     (whitelist), verifica sessão/role e devolve HtmlOutput.
 *   • doPost(e) — Recebe requisições POST para webhooks/callbacks externos
 *     (ex.: futura integração de LLM); responde JSON via ContentService.
 *   • include(filename) — Helper que incorpora parciais HTML no template
 *     (usado dentro dos próprios templates via <?!= include('header') ?>).
 *   • renderPage(templateName, data) — Renderiza template com scriptlets,
 *     define título e meta viewport.
 *   • api_login(email, password), api_register(payload), api_logout(id) —
 *     bridges top-level para AuthService/RegisterService (ver seção
 *     "Bridges de google.script.run" no final do arquivo — necessárias
 *     porque google.script.run não invoca métodos de objetos IIFE).
 *   • Constantes: APP_NAME, APP_VERSION, BATCH_SIZE, DEFAULT_PAGE.
 *
 * SEGURANÇA — PAGE_REGISTRY (whitelist de rotas):
 *   doGet nunca chama HtmlService.createTemplateFromFile() com o parâmetro
 *   de URL bruto — o nome da página é validado contra PAGE_REGISTRY primeiro
 *   (evita servir arquivos .html não pensados como rota, ex.: os parciais
 *   header/footer/sidebar). Cada entrada define o "role" mínimo exigido
 *   (guest/user/admin), conforme a matriz de PermissionService.gs.
 *   IMPORTANTE: ao criar um novo arquivo .html roteável, adicione-o aqui.
 *
 * DEGRADAÇÃO CONTROLADA:
 *   SessionService e PermissionService ainda podem não estar implementados.
 *   doGet detecta isso defensivamente (typeof) e trata o visitante como não
 *   autenticado nesse caso — páginas "guest" continuam funcionando; páginas
 *   "user"/"admin" caem para a tela de login. Nenhuma mudança será necessária
 *   aqui quando esses serviços forem implementados.
 *
 * INTEGRAÇÕES:
 *   • HtmlService — renderiza templates com scriptlets.
 *   • SessionService.getActiveSession(token) — verificação de autenticação
 *     (opcional; token lido de e.parameter.token na URL — ver nota de
 *     arquitetura em SessionService.gs).
 *   • PermissionService.isAdmin() — verificação de role admin (opcional).
 *   • LoggerService.logError() — auditoria de erros de roteamento (opcional).
 *   • AuthService.login()/logout(), RegisterService.register() — via
 *     bridges api_login/api_register/api_logout.
 *
 * PADRÕES:
 *   Service result pattern — { success, data, error } (em doPost).
 *   Fail-safe — qualquer exceção de roteamento cai em error_page, nunca
 *   propaga uma stack trace bruta ao utilizador final.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.2.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const APP_NAME = 'Alquimia do Saber';
const APP_VERSION = '1.1.0';
const BATCH_SIZE = 1000;
const DEFAULT_PAGE = 'index';

// Whitelist de rotas. role: 'guest' (público), 'user' (sessão válida),
// 'admin' (role administrativo). header/footer/sidebar são parciais e não
// aparecem aqui de propósito — não são endpoints válidos.
const PAGE_REGISTRY = {
  // Público / convidado
  index: { role: 'guest' },
  login: { role: 'guest' },
  register: { role: 'guest' },
  forgot_password: { role: 'guest' },
  help: { role: 'guest' },
  error_page: { role: 'guest' },

  // Utilizador autenticado
  welcome: { role: 'user' },
  onboarding: { role: 'user' },
  laboratory: { role: 'user' },
  cauldron: { role: 'user' },
  potion_builder: { role: 'user' },
  scenario_list: { role: 'user' },
  scenario_detail: { role: 'user' },
  scenario_play: { role: 'user' },
  scenario_history: { role: 'user' },
  progression_tree: { role: 'user' },
  result_dashboard: { role: 'user' },
  result_detail: { role: 'user' },
  result_chart: { role: 'user' },
  result_comparison: { role: 'user' },
  vocation_list: { role: 'user' },
  vocation_detail: { role: 'user' },
  domain_map: { role: 'user' },
  profile: { role: 'user' },
  settings: { role: 'user' },
  theme_settings: { role: 'user' },
  leaderboard: { role: 'user' },
  achievement: { role: 'user' },
  notification_panel: { role: 'user' },
  search_results: { role: 'user' },

  // Administração
  admin_dashboard: { role: 'admin' },
  admin_users: { role: 'admin' },
  admin_scenarios: { role: 'admin' },
  admin_vocations: { role: 'admin' },
  admin_settings: { role: 'admin' },
  admin_logs: { role: 'admin' },
  maintenance_panel: { role: 'admin' },
  quota_dashboard: { role: 'admin' },
  data_import: { role: 'admin' },
  data_export: { role: 'admin' },
  backup_restore: { role: 'admin' },
  analytics_dashboard: { role: 'admin' },
  report_individual: { role: 'admin' },
  report_classroom: { role: 'admin' },
  report_school: { role: 'admin' }
};

// Páginas em desenvolvimento podem ser mantidas aqui. Os painéis de cenários
// e configurações deixaram a quarentena após passarem a usar bridges
// autenticadas e persistência real.
const EXPERIMENTAL_PAGES = {};

function _resolveSession(e) {
  try {
    // GAS não tem sessão/cookie nativo entre chamadas de doGet — o token
    // precisa vir explícito na URL (?token=...). Ver nota de arquitetura em
    // SessionService.gs. Sem token, o visitante é tratado como não logado.
    var token = e && e.parameter && e.parameter.token;
    if (token && typeof SessionService !== 'undefined' && SessionService.getActiveSession) {
      var result = SessionService.getActiveSession(token);
      if (result && result.success && result.data) return result.data;
    }
  } catch (err) {
    // SessionService indisponível ou sessão inválida: trata como visitante.
  }
  return null;
}

function _isAdmin(session) {
  if (!session) return false;
  try {
    if (typeof PermissionService !== 'undefined' && PermissionService.isAdmin) {
      var result = PermissionService.isAdmin(session.userId || session.UserID);
      return !!(result && result.success && result.data);
    }
  } catch (err) {
    // Falha ao verificar permissão: nega acesso admin por segurança (fail-safe).
    return false;
  }
  // PermissionService indisponível: usa o role da própria sessão como fallback seguro.
  return session.role === 'admin' || session.Role === 'admin';
}

function _logRoutingError(err, e) {
  try {
    if (typeof LoggerService !== 'undefined' && LoggerService.logError) {
      LoggerService.logError('Code.gs', err, { page: e && e.parameter && e.parameter.page });
    }
  } catch (logErr) {
    // Nunca deixar uma falha de log quebrar o roteamento.
  }
}

function doGet(e) {
  try {
    e = e || {};
    var params = e.parameter || {};
    var pageName = params.page || DEFAULT_PAGE;
    var pageConfig = PAGE_REGISTRY[pageName];

    if (!pageConfig) {
      return renderPage('error_page', { errorCode: 404, errorMessage: 'Página não encontrada.' });
    }

    if (EXPERIMENTAL_PAGES[pageName]) {
      return renderPage('error_page', {
        errorCode: 503,
        errorMessage: 'Esta tela está em quarentena até sua integração com o backend ser homologada.'
      });
    }

    var session = _resolveSession(e);

    if (pageConfig.role !== 'guest' && !session) {
      return renderPage('login', { redirectTo: pageName });
    }

    if (pageConfig.role === 'admin' && !_isAdmin(session)) {
      return renderPage('error_page', { errorCode: 403, errorMessage: 'Acesso restrito a administradores.' });
    }

    return renderPage(pageName, {
      session: session,
      requestParams: params,
      page: pageName,
      redirectTo: params.redirectTo || 'scenario_list',
      appName: APP_NAME,
      appVersion: APP_VERSION
    });
  } catch (err) {
    _logRoutingError(err, e);
    // Sanitiza o erro antes de exibir ao usuário
    var safeMessage = typeof ErrorSanitizer !== 'undefined' 
      ? ErrorSanitizer.sanitize(err) 
      : 'Ocorreu um erro inesperado. Tente novamente.';
    return renderPage('error_page', { errorCode: 500, errorMessage: safeMessage });
  }
}

function doPost(e) {
  try {
    var payload = {};
    if (e && e.postData && e.postData.contents) {
      try {
        payload = JSON.parse(e.postData.contents);
      } catch (parseErr) {
        payload = { raw: e.postData.contents };
      }
    }
    try {
      if (typeof LoggerService !== 'undefined' && LoggerService.log) {
        LoggerService.log('WEBHOOK', 'external', {
          action: (e && e.parameter && e.parameter.action) || 'unknown',
          payloadKeys: Object.keys(payload)
        });
      }
    } catch (logErr) {
      // Log é auxiliar; nunca deve impedir a resposta ao chamador externo.
    }
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, data: null, error: null }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    // Sanitiza o erro antes de enviar ao chamador externo
    var safeMessage = typeof ErrorSanitizer !== 'undefined' 
      ? ErrorSanitizer.sanitize(err) 
      : 'Erro ao processar requisição.';
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, data: null, error: safeMessage }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Dados binários (como o logotipo em base64) não podem carregar quebras de
// linha dentro da string JavaScript gerada pelo HTML Service.
function includeInlineData(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent().replace(/\s+/g, '');
}

// URL absoluta do /exec. As páginas rodam no iframe sandbox do Apps Script,
// cujo documento vive em outro domínio: um destino relativo ('?page=login')
// atribuído a window.top resolveria contra o domínio errado e a navegação
// morreria. Toda navegação de topo precisa desta base.
function getScriptUrl() {
  try {
    return ScriptApp.getService().getUrl() || '';
  } catch (err) {
    return '';
  }
}

function renderPage(templateName, data) {
  var template = HtmlService.createTemplateFromFile(templateName);
  data = data || {};
  Object.keys(data).forEach(function (key) {
    template[key] = data[key];
  });
  // A camada comum entra em todas as rotas sem obrigar cada página temática
  // a duplicar o contrato de foco, toque e redução de movimento.
  var html = template.evaluate().getContent();
  if (html.indexOf('id="ux-standards"') === -1) {
    html = html.replace(/<\/head>/i, include('UX_Standards') + '\n</head>');
  }
  return HtmlService.createHtmlOutput(html)
    .setTitle(APP_NAME + ' — ' + templateName)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ── Bridges de google.script.run ──────────────────────────────────────────
// google.script.run só invoca funções TOP-LEVEL do projeto, nunca métodos de
// um objeto retornado por um IIFE (ex.: AuthService.login() não é chamável
// diretamente pelo cliente). Estas bridges finas expõem os serviços de
// autenticação ao HTML Service; login.html/register.html já as chamam.

// Wrapper que sanitiza automaticamente respostas de erro antes de enviá-las ao frontend
function _safeCall(serviceFn) {
  try {
    var result = serviceFn();
    // Se o resultado é um ServiceResult com erro, sanitiza
    if (result && typeof result === 'object' && result.success === false && result.error) {
      return typeof ErrorSanitizer !== 'undefined'
        ? ErrorSanitizer.sanitizeResult(result)
        : result;
    }
    return result;
  } catch (err) {
    // Exceção não capturada: sanitiza e retorna como ServiceResult
    var safeMessage = typeof ErrorSanitizer !== 'undefined' 
      ? ErrorSanitizer.sanitize(err) 
      : 'Erro inesperado. Tente novamente.';
    return { success: false, data: null, error: safeMessage };
  }
}

function api_login(email, password) {
  return _safeCall(function() {
    return AuthService.login(email, password);
  });
}

function api_register(payload) {
  return _safeCall(function() {
    payload = payload || {};
    return RegisterService.register(payload.email, payload.password, payload.fullName);
  });
}

function api_logout(sessionId) {
  return _safeCall(function() {
    return AuthService.logout(sessionId);
  });
}
// Fluxo autenticado do simulador. Todas as funções recebem o token e derivam
// o UserID no servidor, evitando que o cliente leia ou grave dados de terceiros.
function api_flowGetScenarios(token) {
  return _safeCall(function() {
    return FlowService.getScenarios(token);
  });
}

function api_flowGetScenario(token, scenarioId) {
  return _safeCall(function() {
    return FlowService.getScenario(token, scenarioId);
  });
}

function api_flowPreviewPotion(token, scenarioId, mixture) {
  return _safeCall(function() {
    return FlowService.previewPotion(token, scenarioId, mixture);
  });
}

function api_flowSubmitPotion(token, scenarioId, mixture) {
  return _safeCall(function() {
    return FlowService.submitPotion(token, scenarioId, mixture);
  });
}

function api_getResultDashboard(token) {
  return _safeCall(function() {
    return FlowService.getResultDashboard(token);
  });
}

/**
 * Vizinhanca do estudante no ranking: ate 2 acima e ate 2 abaixo.
 * @param {string} token Token de sessao (o mesmo que viaja na URL).
 * @return {!Object} ServiceResult com { posicao, total, linhas }.
 */
function api_getRankingVizinhanca(token) {
  return _safeCall(function() {
    var sessao = null;
    try {
      if (typeof SessionService !== 'undefined' && SessionService.getActiveSession) {
        var resultado = SessionService.getActiveSession(token);
        if (resultado && resultado.success) sessao = resultado.data;
      }
    } catch (err) {
      sessao = null;
    }
    if (!sessao) return ServiceResult.fail('Sessão inválida ou expirada.');
    return ScoreRankingService.getVizinhanca(sessao.userId || sessao.UserID);
  });
}

function api_flowGenerateReport(token) {
  return _safeCall(function() {
    return FlowService.generateReport(token);
  });
}

/** Lista normalizada para o painel administrativo de cenários. */
function api_getScenarios(token) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, true);
    if (!auth.success) return auth;
    var result = ScenarioController.getAllScenarios();
    if (!result.success) return result;
    var difficultyRanks = { easy: 1, medium: 2, hard: 3, expert: 4 };
    return {
      success: true,
      data: result.data.map(function(row) {
        var rawDifficulty = String(row.Difficulty || '').trim().toLowerCase();
        var difficulty = difficultyRanks[rawDifficulty];
        if (!difficulty && /^[1-4]$/.test(rawDifficulty)) difficulty = Number(rawDifficulty);
        return {
          id: row.ScenarioID,
          title: row.Title || '',
          narrative: row.Narrative || row.Description || '',
          category: row.Category || 'general',
          difficulty: difficulty || 2,
          active: String(row.Status || 'active').toLowerCase() === 'active'
        };
      }),
      error: null
    };
  });
}

/** Cria ou atualiza um cenário; a identidade de auditoria vem da sessão. */
function api_saveAdminScenario(token, payload) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, true);
    if (!auth.success) return auth;
    payload = payload || {};

    var scenarioId = String(payload.id || '').trim();
    var title = String(payload.title || '').trim();
    var narrative = String(payload.narrative || '').trim();
    var category = String(payload.category || '').trim();
    var difficultyInput = String(payload.difficulty === undefined || payload.difficulty === null ? '' : payload.difficulty).trim();
    if (title.length < 3 || title.length > 160) {
      return { success: false, data: null, error: 'O título deve ter entre 3 e 160 caracteres.' };
    }
    if (narrative.length < 10 || narrative.length > 6000) {
      return { success: false, data: null, error: 'A narrativa deve ter entre 10 e 6000 caracteres.' };
    }
    if (!/^[A-Za-z0-9_-]{2,60}$/.test(category)) {
      return { success: false, data: null, error: 'Categoria inválida.' };
    }
    if (!/^[1-4]$/.test(difficultyInput)) {
      return { success: false, data: null, error: 'A dificuldade deve estar entre 1 e 4.' };
    }
    var difficulty = ['easy', 'medium', 'hard', 'expert'][Number(difficultyInput) - 1];

    var actorId = auth.data.userId || auth.data.UserID || 'admin';
    var data = {
      title: title,
      narrative: narrative,
      description: narrative,
      category: category,
      difficulty: difficulty,
      actorId: actorId,
      createdBy: actorId
    };
    var result = scenarioId
      ? ScenarioController.updateScenario(scenarioId, data)
      : ScenarioController.createScenario(data);
    if (!result.success) return result;
    return api_getScenarios(token);
  });
}

/** Ativa ou desativa um cenário existente sem aceitar identidade do cliente. */
function api_setAdminScenarioStatus(token, scenarioId, active) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, true);
    if (!auth.success) return auth;
    scenarioId = String(scenarioId || '').trim();
    if (!scenarioId) return { success: false, data: null, error: 'Cenário não informado.' };
    var actorId = auth.data.userId || auth.data.UserID || 'admin';
    var result = ScenarioController.updateScenario(scenarioId, {
      Status: active ? 'active' : 'inactive',
      actorId: actorId
    });
    if (!result.success) return result;
    return api_getScenarios(token);
  });
}

function api_getWelcomeData(token) {
  return _safeCall(function() {
    return FlowService.getWelcome(token);
  });
}

function api_flowGetHistory(token) {
  return _safeCall(function() {
    return FlowService.getHistory(token);
  });
}

function alquimiaSessionPrincipal_(token, adminOnly) {
  if (!token || typeof SessionService === 'undefined' || !SessionService.getActiveSession) {
    return { success: false, data: null, error: 'Sessao invalida ou expirada.' };
  }
  var sessionResult = SessionService.getActiveSession(token);
  if (!sessionResult || !sessionResult.success || !sessionResult.data) {
    return { success: false, data: null, error: 'Sessao invalida ou expirada.' };
  }
  if (adminOnly && !_isAdmin(sessionResult.data)) {
    return { success: false, data: null, error: 'Acesso restrito a administradores.' };
  }
  return { success: true, data: sessionResult.data, error: null };
}

/** Dados reais da pagina de conquistas, sempre isolados pela sessao. */
function api_getAchievements(token) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, false);
    if (!auth.success) return auth;
    var userId = auth.data.userId || auth.data.UserID;
    var catalogResult = GamificationService.getAchievements();
    if (!catalogResult.success) return catalogResult;

    var badgeResult = GamificationService.getBadges(userId);
    var unlocked = {};
    (badgeResult.success ? badgeResult.data : []).forEach(function(item) { unlocked[item.id] = true; });

    var achievementRows = Utils.getAllRows('UserAchievements');
    var unlockedAt = {};
    if (achievementRows.success) {
      achievementRows.data.forEach(function(row) {
        if (String(row.UserID) === String(userId)) unlockedAt[row.AchievementID] = row.UnlockedAt;
      });
    }

    var resultRows = Utils.getAllRows('Results');
    var userResults = resultRows.success ? resultRows.data.filter(function(row) {
      return String(row.UserID) === String(userId);
    }) : [];
    var domains = {};
    userResults.forEach(function(row) {
      if (!row.VocationID) return;
      var vocation = VocationController.getVocationById(row.VocationID);
      if (vocation.success && vocation.data) domains[vocation.data.Domain] = true;
    });
    var levelResult = GamificationService.getUserLevel(userId);
    var level = levelResult.success && levelResult.data ? Number(levelResult.data.level || 1) : 1;
    var perfectCount = userResults.filter(function(row) { return Number(row.Score || 0) >= 100; }).length;

    var icons = { scenarios: '🧪', domains: '🗺️', level: '🎓', perfect: '⭐' };
    var items = catalogResult.data.map(function(item) {
      var progress = item.requirement === 'domains' ? Object.keys(domains).length
        : item.requirement === 'level' ? level
        : item.requirement === 'perfect' ? perfectCount
        : userResults.length;
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        type: item.requirement === 'level' || item.requirement === 'perfect' ? 'mastery' : 'exploration',
        tier: Number(item.xpBonus || 0) >= 300 ? 'gold' : Number(item.xpBonus || 0) >= 100 ? 'silver' : 'bronze',
        unlocked: !!unlocked[item.id],
        unlockedAt: unlockedAt[item.id] || null,
        progress: Math.min(progress, Number(item.threshold || 1)),
        maxProgress: Number(item.threshold || 1),
        icon: icons[item.requirement] || '🏆'
      };
    });
    return { success: true, data: items, error: null };
  });
}

/** Agrega catalogo e uso real para os seis cards do mapa. */
function api_getDomainMap(token) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, false);
    if (!auth.success) return auth;
    var domainsResult = DomainController.getAllDomains();
    var vocationsResult = VocationController.getAllVocations();
    var popularityResult = AnalyticsService.getVocationPopularity();
    if (!domainsResult.success) return domainsResult;
    var vocations = vocationsResult.success ? vocationsResult.data : [];
    var popularityByDomain = {};
    (popularityResult.success ? popularityResult.data : []).forEach(function(item) {
      popularityByDomain[item.domain] = (popularityByDomain[item.domain] || 0) + Number(item.percentage || 0);
    });
    return {
      success: true,
      data: domainsResult.data.map(function(domain) {
        var code = domain.DomainCode || domain.code;
        return {
          code: code,
          name: domain.Name || domain.name || '',
          description: domain.Description || domain.description || '',
          vocationCount: vocations.filter(function(v) { return String(v.Domain) === String(code); }).length,
          popularityPercent: Math.min(100, popularityByDomain[code] || 0)
        };
      }),
      error: null
    };
  });
}

function api_getVocationDetail(token, vocationId) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, false);
    if (!auth.success) return auth;
    var vocationResult = VocationController.getVocationById(String(vocationId || '').trim());
    if (!vocationResult.success) return vocationResult;
    var relatedResult = VocationController.getVocationsByDomain(vocationResult.data.Domain);
    var related = relatedResult.success ? relatedResult.data.filter(function(item) {
      return item.VocationID !== vocationResult.data.VocationID && item.Status !== 'inactive';
    }).slice(0, 6) : [];
    return { success: true, data: { vocation: vocationResult.data, related: related }, error: null };
  });
}

function _adminUsageByDay_(rows) {
  var timezone = Session.getScriptTimeZone() || 'GMT';
  var now = new Date();
  var dayMs = 24 * 60 * 60 * 1000;
  var weekdayLabels = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  var points = [];
  var byKey = {};

  for (var offset = 6; offset >= 0; offset--) {
    var date = new Date(now.getTime() - (offset * dayMs));
    var key = Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
    var isoWeekday = Number(Utilities.formatDate(date, timezone, 'u'));
    var point = { key: key, label: weekdayLabels[isoWeekday] || 'Dia', value: 0 };
    points.push(point);
    byKey[key] = point;
  }

  (Array.isArray(rows) ? rows : []).forEach(function(row) {
    var rawDate = row && (row.CreatedAt || row.Timestamp || row.createdAt || row.timestamp);
    var date = rawDate ? new Date(rawDate) : null;
    if (!date || isNaN(date.getTime())) return;
    var key = Utilities.formatDate(date, timezone, 'yyyy-MM-dd');
    if (byKey[key]) byKey[key].value++;
  });

  return points.map(function(point) {
    return { label: point.label, value: point.value };
  });
}

function api_getAdminDashboard(token) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, true);
    if (!auth.success) return auth;
    var statsResult = AnalyticsService.getSystemStatistics();
    var usersResult = UserController.getAllUsers();
    var popularityResult = AnalyticsService.getVocationPopularity();
    var interactionsResult = Utils.getAllRows('Interactions');
    var stats = statsResult.success && statsResult.data ? statsResult.data : {};
    var users = usersResult.success ? usersResult.data : [];
    users.sort(function(a, b) { return new Date(b.LastLogin || 0) - new Date(a.LastLogin || 0); });
    var totalUsers = Number(stats.totalUsers || users.length || 0);
    var remainingQuota = 0;
    try { remainingQuota = MailApp.getRemainingDailyQuota(); } catch (quotaError) { remainingQuota = 0; }
    return {
      success: true,
      data: {
        kpis: {
          totalUsers: totalUsers, usersChange: 0,
          totalScenarios: Number(stats.totalScenarios || 0), scenariosChange: 0,
          totalInteractions: interactionsResult.success ? interactionsResult.data.length : 0, interactionsChange: 0,
          totalResults: Number(stats.totalResults || 0), resultsChange: 0
        },
        recentUsers: users.slice(0, 5).map(function(user) {
          return {
            id: user.UserID || user.id,
            name: user.FullName || user.Name || user.Email || 'Usuario',
            email: user.Email || '',
            role: String(user.Role || 'student').toLowerCase() === 'admin' ? 'admin' : 'student',
            lastSeen: user.LastLogin ? Utilities.formatDate(new Date(user.LastLogin), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm') : 'Sem acesso'
          };
        }),
        topVocations: (popularityResult.success ? popularityResult.data : []).slice(0, 5).map(function(item) {
          return { name: item.vocationName, count: Number(item.count || 0), maxCount: Math.max(1, totalUsers) };
        }),
        alerts: [],
        quota: { used: 0, limit: remainingQuota, percent: 0 },
        usageByDay: _adminUsageByDay_(interactionsResult.success ? interactionsResult.data : [])
      },
      error: null
    };
  });
}

function api_forgotPassword(email) {
  return _safeCall(function() {
    return PasswordService.requestPasswordReset(email);
  });
}

/**
 * Compatibilidade para a tela temática antiga do laboratório.
 *
 * O laboratório recebia um payload sem chamar o fluxo autenticado e acabava
 * sempre em reação local. A ponte mantém o nome legado, mas delega para o
 * mesmo serviço usado por potion_builder: a identidade é derivada do token,
 * nunca de um userId enviado pelo navegador.
 */
function api_submitPotion(payload) {
  return _safeCall(function() {
    payload = payload || {};
    var token = payload.token || payload.sessionToken || '';
    if (!token) return ServiceResult.fail('Sessão não informada. Entre novamente.');
    return FlowService.submitPotion(token, payload.scenarioId, payload);
  });
}

// ── Additional API Bridges ────────────────────────────────────────────────
// Bridges adicionais para todos os serviços implementados.
// Organizados por categoria para fácil manutenção.

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIA: USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════
// NOTA: Todas as bridges API usam _safeCall() para sanitizar erros automaticamente.
// Isso previne vazamento de informações técnicas do backend para o frontend.

function api_getAllUsers() {
  return _safeCall(function() {
    return UserController.getAllUsers();
  });
}

function api_getUsers() {
  return _safeCall(function() {
    return UserController.getAllUsers();
  });
}

function api_createUser(data) {
  return _safeCall(function() {
    return UserController.createUser(data);
  });
}

function api_getUserById(userId) {
  return _safeCall(function() {
    return UserController.getUserById(userId);
  });
}

function api_updateUser(userId, data) {
  return _safeCall(function() {
    return UserController.updateUser(userId, data);
  });
}

function api_searchUsers(query) {
  return _safeCall(function() {
    return UserController.searchUsers(query);
  });
}

function api_getUsersByRole(role) {
  return _safeCall(function() {
    return UserController.getUsersByRole(role);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIA: SCENARIOS
// ═══════════════════════════════════════════════════════════════════════════

function api_getAllScenarios() {
  return _safeCall(function() {
    return ScenarioController.getAllScenarios();
  });
}

function api_getScenarioById(scenarioId) {
  return _safeCall(function() {
    return ScenarioController.getScenarioById(scenarioId);
  });
}

function api_getScenariosByCategory(category) {
  return _safeCall(function() {
    return ScenarioController.getScenariosByCategory(category);
  });
}

function api_getScenariosByDifficulty(level) {
  return _safeCall(function() {
    return ScenarioController.getScenariosByDifficulty(level);
  });
}

function api_getRandomScenario(excludeIds) {
  return _safeCall(function() {
    return ScenarioController.getRandomScenario(excludeIds);
  });
}

function api_getNextScenario(userId) {
  return _safeCall(function() {
    return ScenarioController.getNextScenario(userId);
  });
}

function api_createScenario(data, token) {
  return api_saveAdminScenario(token, data);
}

function api_updateScenario(scenarioId, data, token) {
  data = data || {};
  data.id = scenarioId;
  return api_saveAdminScenario(token, data);
}

function api_deleteScenario(scenarioId, token) {
  return api_setAdminScenarioStatus(token, scenarioId, false);
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIA: VOCATIONS
// ═══════════════════════════════════════════════════════════════════════════

function api_getAllVocations() {
  return _safeCall(function() {
    return VocationController.getAllVocations();
  });
}

function api_getVocations() {
  return _safeCall(function() {
    return VocationController.getAllVocations();
  });
}

function api_getVocationById(vocationId) {
  return _safeCall(function() {
    return VocationController.getVocationById(vocationId);
  });
}

function api_getVocationsByDomain(domain) {
  return _safeCall(function() {
    return VocationController.getVocationsByDomain(domain);
  });
}

function api_searchVocations(query) {
  return _safeCall(function() {
    return VocationController.searchVocations(query);
  });
}

function api_matchVocation(dimensions) {
  return _safeCall(function() {
    return VocationController.matchVocation(dimensions);
  });
}

function api_createVocation(data) {
  return _safeCall(function() {
    return VocationController.createVocation(data);
  });
}

function api_importVocations(payload) {
  return _safeCall(function() {
    return VocationController.importVocations(payload);
  });
}

function api_updateVocation(vocationId, data) {
  return _safeCall(function() {
    return VocationController.updateVocation(vocationId, data);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIA: RESULTS
// ═══════════════════════════════════════════════════════════════════════════

function api_createResult(data) {
  return _safeCall(function() {
    return ResultController.createResult(data);
  });
}

function api_getResultsByUser(userId) {
  return _safeCall(function() {
    return ResultController.getResultsByUser(userId);
  });
}

function api_getLatestResult(userId) {
  return _safeCall(function() {
    return ResultController.getLatestResult(userId);
  });
}

function api_getAllResults() {
  return _safeCall(function() {
    return ResultController.getAllResults();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIA: DIMENSIONS & TAXONOMY
// ═══════════════════════════════════════════════════════════════════════════

function api_getUserDimensions(userId) {
  return _safeCall(function() {
    return DimensionService.getAggregateVector(userId);
  });
}

function api_getDimensionPercentages(userId) {
  return _safeCall(function() {
    return DimensionService.getDimensionPercentages(userId);
  });
}

function api_updateUserDimensions(userId, delta) {
  return _safeCall(function() {
    return DimensionService.updateUserDimensions(userId, delta);
  });
}

function api_calculateCompatibility(userDims, formulaDims) {
  return _safeCall(function() {
    return DimensionService.calculateCompatibility(userDims, formulaDims);
  });
}

function api_findBestMatch(dims) {
  return _safeCall(function() {
    return TaxonomyService.findBestMatch(dims);
  });
}

function api_getTopNMatches(dims, n) {
  return _safeCall(function() {
    return TaxonomyService.getTopNMatches(dims, n);
  });
}

function api_calculateEpistemicFormula(dims) {
  return _safeCall(function() {
    return TaxonomyService.calculateEpistemicFormula(dims);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIA: DOMAINS
// ═══════════════════════════════════════════════════════════════════════════

function api_getAllDomains() {
  return _safeCall(function() {
    return DomainController.getAllDomains();
  });
}

function api_getDomainByCode(code) {
  return _safeCall(function() {
    return DomainController.getDomainByCode(code);
  });
}

function api_getVocationsInDomain(code) {
  return _safeCall(function() {
    return DomainController.getVocationsInDomain(code);
  });
}

function api_getDomainStatistics(code) {
  return _safeCall(function() {
    return DomainController.getDomainStatistics(code);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIA: GAMIFICATION & PROGRESSION
// ═══════════════════════════════════════════════════════════════════════════

function api_getUserLevel(userId) {
  return _safeCall(function() {
    return GamificationService.getUserLevel(userId);
  });
}

function api_addXP(userId, amount) {
  return _safeCall(function() {
    return GamificationService.addXP(userId, amount);
  });
}

function api_checkAchievements(userId) {
  return _safeCall(function() {
    return GamificationService.checkAchievements(userId);
  });
}

function api_getBadges(userId) {
  return _safeCall(function() {
    return GamificationService.getBadges(userId);
  });
}
function api_getProgressionStatus(userId) {
  return _safeCall(function() {
    return GamificationService.getProgressionStatus(userId);
  });
}

function api_getProgressionTree(userId) {
  return _safeCall(function() {
    return ProgressionService.getProgressionTree(userId);
  });
}

function api_getProgressionPercent(userId) {
  return _safeCall(function() {
    return ProgressionService.getProgressionPercent(userId);
  });
}

function api_getNextMilestone(userId) {
  return _safeCall(function() {
    return ProgressionService.getNextMilestone(userId);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIA: SCORING
// ═══════════════════════════════════════════════════════════════════════════

function api_calculateScore(interaction) {
  return _safeCall(function() {
    return ScoreService.calculateScore(interaction);
  });
}

function api_getItemDifficulty(scenarioId) {
  return _safeCall(function() {
    return ScoreService.getItemDifficulty(scenarioId);
  });
}

function api_getScoreBreakdown(interaction) {
  return _safeCall(function() {
    return ScoreService.getScoreBreakdown(interaction);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIA: NARRATIVE & ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

function api_generateOpeningNarrative(userId) {
  return _safeCall(function() {
    return NarrativeEngine.generateOpeningNarrative(userId);
  });
}

function api_generateScenarioNarrative(scenarioId, userId) {
  return _safeCall(function() {
    return NarrativeEngine.generateScenarioNarrative(scenarioId, userId);
  });
}

function api_generateEnding(userId) {
  return _safeCall(function() {
    return NarrativeEngine.generateEnding(userId);
  });
}

function api_getNarrativeProgress(userId) {
  return _safeCall(function() {
    return NarrativeEngine.getNarrativeProgress(userId);
  });
}

function api_analyzeText(text, scenarioId) {
  return _safeCall(function() {
    return SemanticAnalyzer.analyze(text, scenarioId);
  });
}

function api_evaluateResponse(text, scenarioId) {
  return _safeCall(function() {
    return LLMService.evaluateResponse(text, scenarioId);
  });
}

function api_generateFeedback(response, score) {
  return _safeCall(function() {
    return LLMService.generateFeedback(response, score);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIA: ANALYTICS & REPORTS
// ═══════════════════════════════════════════════════════════════════════════

function api_getSystemStatistics() {
  return _safeCall(function() {
    return AnalyticsService.getSystemStatistics();
  });
}

function api_getVocationPopularity() {
  return _safeCall(function() {
    return AnalyticsService.getVocationPopularity();
  });
}

function api_getDimensionDistribution() {
  return _safeCall(function() {
    return AnalyticsService.getDimensionDistribution();
  });
}

function api_getEngagementMetrics() {
  return _safeCall(function() {
    return AnalyticsService.getEngagementMetrics();
  });
}

function api_getTrendAnalysis(timeframe) {
  return _safeCall(function() {
    return AnalyticsService.getTrendAnalysis(timeframe);
  });
}

function api_generateIndividualReport(userId) {
  return _safeCall(function() {
    return ReportService.generateIndividualReport(userId);
  });
}

/** Diretório mínimo usado apenas pelos relatórios administrativos. */
function api_getReportDirectory(token) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, true);
    if (!auth.success) return auth;
    var usersResult = UserController.getAllUsers();
    if (!usersResult.success) return usersResult;
    var classes = {};
    var schools = {};
    var users = usersResult.data.map(function(user) {
      if (user.ClassID) classes[String(user.ClassID)] = true;
      if (user.SchoolID) schools[String(user.SchoolID)] = true;
      return {
        id: user.UserID,
        name: user.FullName,
        classId: user.ClassID || '',
        schoolId: user.SchoolID || '',
        status: user.Status
      };
    });
    return {
      success: true,
      data: { users: users, classIds: Object.keys(classes).sort(), schoolIds: Object.keys(schools).sort() },
      error: null
    };
  });
}

/** Gera somente os três tipos de relatório liberados, sempre após RBAC admin. */
function api_generateAdminReport(token, type, scopeId) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, true);
    if (!auth.success) return auth;
    var normalizedType = String(type || '').toLowerCase();
    var normalizedId = String(scopeId || '').trim().slice(0, 120);
    if (!normalizedId) return { success: false, data: null, error: 'Selecione o escopo do relatório.' };
    if (normalizedType === 'individual') return ReportService.generateIndividualReport(normalizedId);
    if (normalizedType === 'classroom') return ReportService.generateClassroomReport(normalizedId);
    if (normalizedType === 'school') return ReportService.generateSchoolReport(normalizedId);
    return { success: false, data: null, error: 'Tipo de relatório inválido.' };
  });
}

function api_generateExecutiveSummary(userId) {
  return _safeCall(function() {
    return ReportService.generateExecutiveSummary(userId);
  });
}

function api_generateVocationReport(vocationId) {
  return _safeCall(function() {
    return ReportService.generateVocationReport(vocationId);
  });
}

function api_getReportTemplates() {
  return _safeCall(function() {
    return ReportService.getReportTemplates();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIA: EXPORT & BACKUP
// ═══════════════════════════════════════════════════════════════════════════

function api_exportUsersCSV() {
  return _safeCall(function() {
    return ExportService.exportUsersCSV();
  });
}

function api_exportLogsCSV(filters) {
  var token = arguments.length > 1 ? arguments[1] : '';
  var session = _requireAdminSession_(token);
  if (!session.success) return session;
  return ExportService.exportLogsCSV(filters);
}

function _requireAdminSession_(token) {
  if (!token || typeof SessionService === 'undefined' || !SessionService.getActiveSession) {
    return ServiceResult.fail('Sessão administrativa não informada.');
  }
  var active = SessionService.getActiveSession(token);
  if (!active || !active.success || !active.data) {
    return ServiceResult.fail('Sessão inválida ou expirada.');
  }
  if (typeof PermissionService === 'undefined' || !PermissionService.isAdmin) {
    return ServiceResult.fail('Permissão administrativa indisponível.');
  }
  var permission = PermissionService.isAdmin(active.data.userId);
  if (!permission || !permission.success || !permission.data) {
    return ServiceResult.fail('Acesso restrito a administradores.');
  }
  return active;
}

/** Ponte usada pelo painel administrativo de logs. */
function api_purgeLogs(days, token) {
  var session = _requireAdminSession_(token);
  if (!session.success) return session;
  return LoggerService.purgeOldLogs(Math.max(1, parseInt(days, 10) || 90));
}

/** Retorna o último relatório de manutenção para uma sessão administrativa. */
function api_getMaintenanceReport(token) {
  var session = _requireAdminSession_(token);
  if (!session.success) return session;
  return MaintenanceService.getMaintenanceReport();
}

/** Executa limpeza de sessões, logs, cache e inventário da planilha. */
function api_runFullMaintenance(token) {
  var session = _requireAdminSession_(token);
  if (!session.success) return session;
  return MaintenanceService.runFullMaintenance();
}

/** Atualiza o inventário de tamanho das abas sem alterar os dados. */
function api_optimizeMaintenanceSheet(token) {
  var session = _requireAdminSession_(token);
  if (!session.success) return session;
  return MaintenanceService.optimizeSheet();
}

/** Configura a retenção de logs usada na próxima manutenção. */
function api_setMaintenanceRetention(token, days) {
  var session = _requireAdminSession_(token);
  if (!session.success) return session;
  var retention = Number(days);
  if (!isFinite(retention) || retention < 30 || retention > 365) {
    return ServiceResult.fail('A retenção deve ficar entre 30 e 365 dias.');
  }
  return ConfigService.set('LOG_RETENTION_DAYS', String(Math.round(retention)));
}

function api_exportResultsCSV(userId) {
  return _safeCall(function() {
    return ExportService.exportResultsCSV(userId);
  });
}

function api_exportAllDataJSON() {
  return _safeCall(function() {
    return ExportService.exportAllDataJSON();
  });
}

/** Cria um backup completo apenas para uma sessão administrativa válida. */
function api_backupAllData(token) {
  return _safeCall(function() {
    var session = _requireAdminSession_(token);
    if (!session.success) return session;
    return ExportService.backupAllData();
  });
}

/** Lista somente os metadados dos backups; o conteúdo do backup nunca é listado. */
function api_listBackups(token) {
  return _safeCall(function() {
    var session = _requireAdminSession_(token);
    if (!session.success) return session;

    var result = Utils.getAllRows('Backups');
    if (!result.success) return result;

    var rows = (result.data || []).map(function(row) {
      var rawTimestamp = row.Timestamp;
      var date = rawTimestamp instanceof Date ? rawTimestamp : new Date(rawTimestamp);
      var timestamp = isNaN(date.getTime()) ? String(rawTimestamp || '') : date.toISOString();
      return {
        id: String(row.BackupID || ''),
        timestamp: timestamp,
        tableCount: Number(row.TableCount || 0) || 0,
        status: String(row.Status || 'unknown')
      };
    }).filter(function(item) {
      return !!item.id;
    });

    rows.sort(function(a, b) {
      return String(b.timestamp).localeCompare(String(a.timestamp));
    });

    return { success: true, data: rows, error: null };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIA: VALIDATION & SANITIZATION
// ═══════════════════════════════════════════════════════════════════════════

function api_validateEmail(email) {
  return _safeCall(function() {
    return ValidationService.validateEmail(email);
  });
}

function api_validatePassword(password) {
  return _safeCall(function() {
    return ValidationService.validatePassword(password);
  });
}

function api_validateRegistration(email, password, name) {
  return _safeCall(function() {
    return ValidationService.validateRegistration(email, password, name);
  });
}

function api_validateScenario(data) {
  return _safeCall(function() {
    return ValidationService.validateScenario(data);
  });
}

function api_validateVocation(data) {
  return _safeCall(function() {
    return ValidationService.validateVocation(data);
  });
}

function api_sanitizeInput(input) {
  return _safeCall(function() {
    return SanitizeService.cleanInput(input);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIA: PASSWORD MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

function api_changePassword(userId, oldPassword, newPassword) {
  return _safeCall(function() {
    return PasswordService.changePassword(userId, oldPassword, newPassword);
  });
}

function api_resetPassword(email, newPassword) {
  return _safeCall(function() {
    return PasswordService.resetPassword(email, newPassword);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIA: PERMISSIONS
// ═══════════════════════════════════════════════════════════════════════════

function api_isAdmin(userId) {
  return _safeCall(function() {
    return PermissionService.isAdmin(userId);
  });
}

function api_hasRole(userId, role) {
  return _safeCall(function() {
    return PermissionService.hasRole(userId, role);
  });
}

function api_getAccessibleRoutes(role) {
  return _safeCall(function() {
    return PermissionService.getAccessibleRoutes(role);
  });
}

/** Navegação e progresso derivados exclusivamente da sessão ativa. */
function api_getSidebarData(token) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, false);
    if (!auth.success) return auth;
    var principal = auth.data;
    var userId = principal.userId || principal.UserID;
    var role = String(principal.role || principal.Role || 'user').toLowerCase();
    var progress = ProgressionService.getProgressionPercent(userId);
    var routeNames = Object.keys(PAGE_REGISTRY).filter(function(routeName) {
      var requiredRole = PAGE_REGISTRY[routeName].role;
      return requiredRole === 'guest' || role === 'admin' || requiredRole === 'user';
    });
    return {
      success: true,
      data: {
        role: role,
        routes: routeNames,
        progressPercent: progress.success ? Number(progress.data || 0) : 0
      },
      error: null
    };
  });
}

/** Busca global sem expor utilizadores a sessões sem papel administrativo. */
function api_searchCatalog(token, query, types) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, false);
    if (!auth.success) return auth;
    var normalizedQuery = String(query || '').trim().slice(0, 80);
    if (normalizedQuery.length < 2) {
      return { success: false, data: null, error: 'Digite ao menos dois caracteres.' };
    }
    var requested = Array.isArray(types) && types.length ? types : ['scenarios', 'vocations'];
    var q = normalizedQuery.toLowerCase();
    var response = { scenarios: [], vocations: [], users: [] };

    if (requested.indexOf('scenarios') >= 0) {
      var scenarios = ScenarioController.getAllScenarios();
      if (scenarios.success) {
        response.scenarios = scenarios.data.filter(function(item) {
          return [item.Title, item.Description, item.Category].some(function(value) {
            return String(value || '').toLowerCase().indexOf(q) >= 0;
          });
        }).slice(0, 25).map(function(item) {
          return {
            id: item.ScenarioID,
            title: item.Title,
            description: item.Description,
            category: item.Category,
            difficulty: item.Difficulty
          };
        });
      }
    }

    if (requested.indexOf('vocations') >= 0) {
      var vocations = VocationController.searchVocations(normalizedQuery);
      if (vocations.success) {
        response.vocations = vocations.data.slice(0, 25).map(function(item) {
          return {
            id: item.VocationID,
            title: item.Title,
            description: item.Description,
            domain: item.Domain
          };
        });
      }
    }

    if (requested.indexOf('users') >= 0 && _isAdmin(auth.data)) {
      var users = UserController.searchUsers(normalizedQuery);
      if (users.success) {
        response.users = users.data.slice(0, 25).map(function(item) {
          return {
            id: item.UserID,
            name: item.FullName,
            role: item.Role,
            status: item.Status
          };
        });
      }
    }

    return { success: true, data: response, error: null };
  });
}

/** Histórico e preferências de notificação da própria sessão. */
function api_getNotificationCenter(token) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, false);
    if (!auth.success) return auth;
    var userId = auth.data.userId || auth.data.UserID;
    var history = NotificationService.getNotificationHistory(userId);
    var profile = UserProfileService.getProfile(userId);
    return {
      success: true,
      data: {
        items: history.success && Array.isArray(history.data) ? history.data : [],
        preferences: profile.success ? profile.data.notificationPreferences || {} : {}
      },
      error: null
    };
  });
}

/** Atualiza somente as quatro preferências de notificação autorizadas. */
function api_saveNotificationPreferences(token, preferences) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, false);
    if (!auth.success) return auth;
    var requested = preferences || {};
    var safePreferences = {};
    ['email', 'achievements', 'results', 'reminders'].forEach(function(key) {
      safePreferences[key] = requested[key] === true;
    });
    return UserProfileService.setNotificationPreferences(
      auth.data.userId || auth.data.UserID,
      safePreferences
    );
  });
}

/** Fotografia operacional de quota, gatilhos e cache para administradores. */
function api_getQuotaDashboard(token) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, true);
    if (!auth.success) return auth;
    var quota = TriggerService.getQuotaUsage();
    var triggers = TriggerService.getAllTriggers();
    var cache = CacheController.getCacheStatistics();
    return {
      success: quota.success && triggers.success && cache.success,
      data: {
        quota: quota.success ? quota.data : null,
        triggers: triggers.success ? triggers.data : [],
        cache: cache.success ? cache.data : null
      },
      error: quota.error || triggers.error || cache.error || null
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIA: LOGGING
// ═══════════════════════════════════════════════════════════════════════════

function api_getLogs(filters, token) {
  var session = _requireAdminSession_(token);
  if (!session.success) return session;
  return LoggerService.getLogs(filters);
}

// ═══════════════════════════════════════════════════════════════════════════
// CATEGORIA: CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

function api_getSetting(name) {
  return _safeCall(function() {
    return ConfigService.getSetting(name);
  });
}

function api_getAllSettings() {
  return _safeCall(function() {
    return ConfigService.getAllSettings();
  });
}

/** Configurações normalizadas para o painel administrativo. */
function api_getSettings(token) {
  var auth = alquimiaSessionPrincipal_(token, true);
  if (!auth.success) return auth;
  return _safeCall(function() {
    return SettingsController.getAllSettings();
  });
}

/** Atualiza em lote apenas as configurações expostas pelo painel. */
function api_saveAdminSettings(token, changes) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, true);
    if (!auth.success) return auth;
    changes = changes || {};
    var allowed = {
      APP_NAME: { type: 'text', min: 3, max: 120 },
      ADMIN_EMAIL: { type: 'email', min: 3, max: 180 },
      LOG_RETENTION_DAYS: { type: 'number', min: 30, max: 365 },
      PUBLIC_REGISTRATION: { type: 'boolean' },
      ACHIEVEMENTS_ENABLED: { type: 'boolean' },
      LEADERBOARD_ENABLED: { type: 'boolean' },
      EXPORT_RESULTS_ENABLED: { type: 'boolean' },
      MAX_SESSION_DURATION: { type: 'number', min: 900, max: 28800 },
      MAINTENANCE_MODE: { type: 'boolean' }
    };
    var keys = Object.keys(changes);
    if (!keys.length) return { success: false, data: null, error: 'Nenhuma alteração informada.' };
    var actorId = auth.data.userId || auth.data.UserID || 'admin';
    var errors = [];

    keys.forEach(function(key) {
      var rule = allowed[key];
      if (!rule) {
        errors.push(key + ': configuração não permitida');
        return;
      }
      var value = changes[key];
      if (rule.type === 'boolean') {
        value = value === true || String(value).toLowerCase() === 'true' ? 'true' : 'false';
      } else if (rule.type === 'number') {
        value = Number(value);
        if (!isFinite(value) || value < rule.min || value > rule.max) {
          errors.push(key + ': valor fora do intervalo permitido');
          return;
        }
        value = String(Math.round(value));
      } else {
        value = String(value == null ? '' : value).trim();
        if (value.length < rule.min || value.length > rule.max ||
            (rule.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) {
          errors.push(key + ': valor inválido');
          return;
        }
      }

      var existing = SettingsController.getSetting(key);
      var result = existing.success
        ? SettingsController.updateSetting(key, value, actorId)
        : SettingsController.createSetting(key, value, 'Configuração administrada pelo painel', 'Admin');
      if (!result.success) errors.push(key + ': ' + result.error);
    });

    if (errors.length) return { success: false, data: { errors: errors }, error: errors.join('; ') };
    return SettingsController.getAllSettings();
  });
}

/** Exporta uma fotografia das configurações após validar a sessão admin. */
function api_exportAdminSettings(token) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, true);
    if (!auth.success) return auth;
    return SettingsController.exportSettings();
  });
}

/** Registra erro sanitizado enviado pela tela de erro em modo de diagnóstico. */
function api_logError(payload) {
  payload = payload || {};
  var message = String(payload.message || 'Erro de frontend').slice(0, 500);
  var code = String(payload.code || 'UNKNOWN').slice(0, 40);
  if (typeof LoggerService !== 'undefined' && LoggerService.logError) {
    return LoggerService.logError('frontend:' + code, new Error(message), {});
  }
  return { success: true, data: null, error: null };
}

function api_getAppVersion() {
  return { success: true, data: { version: APP_VERSION }, error: null };
}

/** Perfil derivado exclusivamente do token enviado pelo navegador. */
function api_getUserProfile(token) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, false);
    if (!auth.success) return auth;
    return AuthService.getCurrentUser(token);
  });
}

/** Painel de perfil isolado pela identidade da sessão, sem userId do cliente. */
function api_getProfileDashboard(token) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, false);
    if (!auth.success) return auth;
    var userId = auth.data.userId || auth.data.UserID;
    var profile = UserProfileService.getProfile(userId);
    if (!profile.success) return profile;
    var badges = GamificationService.getBadges(userId);
    return {
      success: true,
      data: { profile: profile.data, badges: badges.success ? badges.data : [] },
      error: null
    };
  });
}

/** Preferencias pessoais derivadas da sessao, sem aceitar userId do cliente. */
function api_getUserSettings(token) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, false);
    if (!auth.success) return auth;
    var userId = auth.data.userId || auth.data.UserID;
    var profile = UserProfileService.getProfile(userId);
    if (!profile.success) return profile;
    return {
      success: true,
      data: {
        preferredDomains: Array.isArray(profile.data.preferredDomains) ? profile.data.preferredDomains : [],
        notificationPreferences: profile.data.notificationPreferences || {}
      },
      error: null
    };
  });
}

/** Persiste apenas dominios e notificacoes permitidos para o usuario ativo. */
function api_saveUserSettings(token, payload) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, false);
    if (!auth.success) return auth;
    payload = payload || {};
    var allowedDomains = ['A', 'B', 'C', 'D', 'E', 'F'];
    var domains = [];
    (Array.isArray(payload.preferredDomains) ? payload.preferredDomains : []).forEach(function(domain) {
      domain = String(domain || '').toUpperCase();
      if (allowedDomains.indexOf(domain) >= 0 && domains.indexOf(domain) < 0) domains.push(domain);
    });
    if (!domains.length) return { success: false, data: null, error: 'Escolha ao menos um domínio de interesse.' };

    var requested = payload.notificationPreferences || {};
    var notifications = {};
    ['email', 'achievements', 'results', 'reminders'].forEach(function(key) {
      notifications[key] = requested[key] === true;
    });
    var userId = auth.data.userId || auth.data.UserID;
    var updated = UserProfileService.updateProfile(userId, {
      preferredDomains: domains,
      notificationPreferences: notifications
    });
    if (!updated.success) return updated;
    return {
      success: true,
      data: { preferredDomains: domains, notificationPreferences: notifications },
      error: null
    };
  });
}

/** Operacao destrutiva limitada ao vetor da propria sessao. */
function api_resetUserDimensions(token) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, false);
    if (!auth.success) return auth;
    return DimensionController.resetDimension(auth.data.userId || auth.data.UserID);
  });
}

/** Árvore e próximos marcos sempre calculados para a sessão ativa. */
function api_getProgressionDashboard(token) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, false);
    if (!auth.success) return auth;
    var userId = auth.data.userId || auth.data.UserID;
    var tree = ProgressionService.getProgressionTree(userId);
    if (!tree.success) return tree;
    var percent = ProgressionService.getProgressionPercent(userId);
    var milestone = ProgressionService.getNextMilestone(userId);
    var next = ScenarioController.getNextScenario(userId);
    return {
      success: true,
      data: {
        tree: tree.data,
        percent: percent.success ? percent.data : 0,
        nextMilestone: milestone.success ? milestone.data : null,
        nextScenario: next.success ? next.data : null
      },
      error: null
    };
  });
}

/** Dados dos gráficos do próprio aluno, com fallback determinístico vazio. */
function api_getResultChartDashboard(token) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, false);
    if (!auth.success) return auth;
    var userId = auth.data.userId || auth.data.UserID;
    var radar = ResultChartService.generateRadarChart(userId);
    if (!radar.success) return radar;
    var line = ResultChartService.generateLineChart(userId);
    var percentages = DimensionService.getDimensionPercentages(userId);
    return {
      success: true,
      data: {
        radar: radar.data,
        line: line.success ? line.data : { labels: [], values: [], title: 'Evolução da pontuação' },
        percentages: percentages.success ? percentages.data : {}
      },
      error: null
    };
  });
}

/** Detalhe do resultado mais recente; vocationId é apenas um filtro de leitura. */
function api_getResultDetailDashboard(token, vocationId) {
  return _safeCall(function() {
    var auth = alquimiaSessionPrincipal_(token, false);
    if (!auth.success) return auth;
    var userId = auth.data.userId || auth.data.UserID;
    var latest = ResultController.getLatestResult(userId);
    var result = latest.success ? latest.data : null;
    var requestedId = String(vocationId || (result && (result.VocationID || result.vocationId)) || '').trim();
    var sanitizedId = ValidationService.sanitize(requestedId);
    var selectedId = sanitizedId && sanitizedId.success ? String(sanitizedId.data || '').trim() : '';
    if (selectedId && !/^[A-Za-z0-9_-]{1,120}$/.test(selectedId)) {
      return { success: false, data: null, error: 'Identificador de vocação inválido.' };
    }
    if (!selectedId) return { success: true, data: { result: result, vocation: null, related: [] }, error: null };
    var vocation = VocationController.getVocationById(selectedId);
    if (!vocation.success) return vocation;
    var related = VocationController.getVocationsByDomain(vocation.data.Domain);
    return {
      success: true,
      data: {
        result: result,
        vocation: vocation.data,
        related: related.success ? related.data.filter(function(item) { return item.VocationID !== selectedId; }).slice(0, 5) : []
      },
      error: null
    };
  });
}

function api_isFeatureEnabled(featureName) {
  return _safeCall(function() {
    return ConfigService.isFeatureEnabled(featureName);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// FIM DOS API BRIDGES
// Total de bridges implementados: 100+
// Todos seguem padrão: function api_nomeFuncao(params) { return Service.metodo(params); }
// ═══════════════════════════════════════════════════════════════════════════
