/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — UserProfileService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Serviço de perfis estendidos de utilizadores. Gerencia preferências, avatares,
 *   histórico de progresso e configurações pessoais além dos dados básicos de Users.
 *
 * FUNCIONALIDADES:
 *   • getProfile(userId) — Recupera perfil completo com estatísticas.
 *   • updateProfile(userId, data) — Atualiza dados do perfil.
 *   • setPreferredDomains(userId, domains) — Define domínios de interesse.
 *   • getProgress(userId) — Retorna progresso detalhado no simulador.
 *   • updateAvatar(userId, avatarUrl) — Atualiza avatar do utilizador.
 *   • getStatistics(userId) — Estatísticas gerais (XP, cenários, conquistas).
 *   • setNotificationPreferences(userId, prefs) — Preferências de notificação.
 *   • getCompletionRate(userId) — Taxa de conclusão de cenários.
 *
 * INTEGRAÇÕES:
 *   • UserController — dados básicos do utilizador.
 *   • GamificationService — XP e conquistas.
 *   • ResultController — resultados e histórico.
 *   • DimensionService — vectores psicométricos.
 *   • AppCacheService — cache de perfis.
 *
 * PADRÕES:
 *   Batch read — Utils.getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *   Cache-friendly — profiles cacheados por 15 minutos.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const UserProfileService = (function () {

  var CACHE_TTL = 900; // 15 minutos
  var DEFAULT_AVATAR = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150" viewBox="0 0 150 150"%3E%3Crect width="150" height="150" rx="24" fill="%23352361"/%3E%3Ccircle cx="75" cy="57" r="25" fill="%23c4b9e2"/%3E%3Cpath d="M30 132c4-28 20-42 45-42s41 14 45 42" fill="%23c4b9e2"/%3E%3C/svg%3E';
  var DOMAINS = ['A', 'B', 'C', 'D', 'E', 'F'];

  function _cacheKey(userId) {
    return 'profile_' + userId;
  }

  function _invalidateCache(userId) {
    try {
      if (typeof AppCacheService !== 'undefined') {
        AppCacheService.remove(_cacheKey(userId));
      }
    } catch (err) {
      // Cache é opcional
    }
  }

  function getProfile(userId) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    
    try {
      // Tenta cache primeiro
      if (typeof AppCacheService !== 'undefined') {
        var cached = AppCacheService.get(_cacheKey(userId));
        if (cached.success && cached.data !== null) {
          return { success: true, data: cached.data, error: null };
        }
      }
      
      // Busca dados básicos do utilizador
      var userResult = typeof UserController !== 'undefined' && UserController.getUserById
        ? UserController.getUserById(userId)
        : { success: false, error: 'UserController não disponível' };
      
      if (!userResult.success) {
        return { success: false, data: null, error: userResult.error };
      }
      
      var user = userResult.data;
      
      // Busca estatísticas de gamificação
      var stats = getStatistics(userId);
      
      // Busca dimensões psicométricas
      var dimensions = null;
      if (typeof DimensionService !== 'undefined' && DimensionService.getAggregateVector) {
        var dimResult = DimensionService.getAggregateVector(userId);
        if (dimResult.success) {
          dimensions = dimResult.data;
        }
      }
      
      // Busca taxa de conclusão
      var completionRate = getCompletionRate(userId);
      
      // Monta perfil completo
      var profile = {
        userId: userId,
        email: user.Email,
        fullName: user.FullName,
        role: user.Role,
        status: user.Status,
        avatar: user.Avatar || DEFAULT_AVATAR,
        createdAt: user.CreatedAt,
        lastLogin: user.LastLogin,
        preferredDomains: user.PreferredDomains ? JSON.parse(user.PreferredDomains) : [],
        notificationPreferences: user.NotificationPreferences ? JSON.parse(user.NotificationPreferences) : {
          email: true,
          achievements: true,
          results: true,
          reminders: true
        },
        statistics: stats.success ? stats.data : {
          totalXP: 0,
          level: 1,
          scenariosCompleted: 0,
          achievementsUnlocked: 0
        },
        dimensions: dimensions,
        completionRate: completionRate.success ? completionRate.data : 0
      };
      
      // Cacheia o perfil
      if (typeof AppCacheService !== 'undefined') {
        AppCacheService.put(_cacheKey(userId), profile, CACHE_TTL);
      }
      
      return { success: true, data: profile, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function updateProfile(userId, data) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    if (!data || typeof data !== 'object') {
      return { success: false, data: null, error: 'Dados de atualização são obrigatórios.' };
    }
    
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      
      var sheet = Utils.getSheet('Users');
      if (!sheet) return { success: false, data: null, error: 'Aba Users não encontrada.' };
      
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var userIdCol = headers.indexOf('UserID');
      
      if (userIdCol === -1) {
        return { success: false, data: null, error: 'Coluna UserID não encontrada.' };
      }
      
      // Busca linha do utilizador
      var rowIndex = -1;
      for (var i = 1; i < values.length; i++) {
        if (values[i][userIdCol] === userId) {
          rowIndex = i;
          break;
        }
      }
      
      if (rowIndex === -1) {
        return { success: false, data: null, error: 'Utilizador não encontrado.' };
      }
      
      // Atualiza campos permitidos
      var updatableFields = {
        'FullName': data.fullName,
        'Avatar': data.avatar,
        'PreferredDomains': data.preferredDomains ? JSON.stringify(data.preferredDomains) : undefined,
        'NotificationPreferences': data.notificationPreferences ? JSON.stringify(data.notificationPreferences) : undefined
      };
      
      Object.keys(updatableFields).forEach(function(field) {
        var colIndex = headers.indexOf(field);
        if (colIndex !== -1 && updatableFields[field] !== undefined) {
          values[rowIndex][colIndex] = updatableFields[field];
        }
      });
      
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      
      _invalidateCache(userId);
      
      return { success: true, data: { userId: userId, updated: true }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function setPreferredDomains(userId, domains) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    if (!Array.isArray(domains)) {
      return { success: false, data: null, error: 'Domains deve ser um array.' };
    }
    
    // Valida domínios
    var validDomains = domains.filter(function(d) {
      return DOMAINS.indexOf(String(d).toUpperCase()) !== -1;
    });
    
    if (validDomains.length === 0) {
      return { success: false, data: null, error: 'Nenhum domínio válido fornecido (A-F).' };
    }
    
    return updateProfile(userId, { preferredDomains: validDomains });
  }

  function getProgress(userId) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    
    try {
      // Busca todos os resultados do utilizador
      var resultsResult = typeof ResultController !== 'undefined' && ResultController.getResultsByUser
        ? ResultController.getResultsByUser(userId)
        : { success: false, data: [] };
      
      if (!resultsResult.success) {
        return { success: true, data: { total: 0, byDifficulty: {}, byDomain: {}, timeline: [] }, error: null };
      }
      
      var results = resultsResult.data;
      
      // Agrupa por dificuldade
      var byDifficulty = {
        easy: 0,
        medium: 0,
        hard: 0,
        expert: 0
      };
      
      // Agrupa por domínio
      var byDomain = {};
      DOMAINS.forEach(function(d) { byDomain[d] = 0; });
      
      // Timeline (últimos 10)
      var timeline = [];
      
      results.forEach(function(result) {
        var difficulty = String(result.Difficulty || 'medium').toLowerCase();
        if (byDifficulty[difficulty] !== undefined) {
          byDifficulty[difficulty]++;
        }
        
        var domain = String(result.Domain || 'A').toUpperCase();
        if (byDomain[domain] !== undefined) {
          byDomain[domain]++;
        }
        
        if (timeline.length < 10) {
          timeline.push({
            resultId: result.ResultID,
            scenarioId: result.ScenarioID,
            score: result.Score,
            date: result.SubmittedAt
          });
        }
      });
      
      return {
        success: true,
        data: {
          total: results.length,
          byDifficulty: byDifficulty,
          byDomain: byDomain,
          timeline: timeline
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function updateAvatar(userId, avatarUrl) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    if (!avatarUrl) return { success: false, data: null, error: 'Avatar URL é obrigatória.' };
    
    // Valida URL básica
    var urlPattern = /^https?:\/\/.+/i;
    if (!urlPattern.test(avatarUrl)) {
      return { success: false, data: null, error: 'URL de avatar inválida.' };
    }
    
    return updateProfile(userId, { avatar: avatarUrl });
  }

  function getStatistics(userId) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    
    try {
      var stats = {
        totalXP: 0,
        level: 1,
        scenariosCompleted: 0,
        achievementsUnlocked: 0,
        totalScore: 0,
        averageScore: 0
      };
      
      // Busca XP e nível
      if (typeof GamificationService !== 'undefined' && GamificationService.getUserLevel) {
        var levelResult = GamificationService.getUserLevel(userId);
        if (levelResult.success) {
          stats.totalXP = levelResult.data.xp || 0;
          stats.level = levelResult.data.level || 1;
        }
      }
      
      // Busca conquistas
      if (typeof GamificationService !== 'undefined' && GamificationService.getUserAchievements) {
        var achievementsResult = GamificationService.getUserAchievements(userId);
        if (achievementsResult.success) {
          stats.achievementsUnlocked = achievementsResult.data.length;
        }
      }
      
      // Busca cenários completados e pontuação
      if (typeof ResultController !== 'undefined' && ResultController.getResultsByUser) {
        var resultsResult = ResultController.getResultsByUser(userId);
        if (resultsResult.success) {
          stats.scenariosCompleted = resultsResult.data.length;
          
          var totalScore = 0;
          resultsResult.data.forEach(function(result) {
            totalScore += Number(result.Score || 0);
          });
          
          stats.totalScore = totalScore;
          stats.averageScore = stats.scenariosCompleted > 0 
            ? Math.round(totalScore / stats.scenariosCompleted) 
            : 0;
        }
      }
      
      return { success: true, data: stats, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function setNotificationPreferences(userId, prefs) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    if (!prefs || typeof prefs !== 'object') {
      return { success: false, data: null, error: 'Preferências são obrigatórias.' };
    }
    
    // Valida estrutura das preferências
    var validPrefs = {
      email: typeof prefs.email === 'boolean' ? prefs.email : true,
      achievements: typeof prefs.achievements === 'boolean' ? prefs.achievements : true,
      results: typeof prefs.results === 'boolean' ? prefs.results : true,
      reminders: typeof prefs.reminders === 'boolean' ? prefs.reminders : true
    };
    
    return updateProfile(userId, { notificationPreferences: validPrefs });
  }

  function getCompletionRate(userId) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    
    try {
      // Busca total de cenários disponíveis
      var totalScenarios = 0;
      if (typeof ScenarioController !== 'undefined' && ScenarioController.getAllScenarios) {
        var scenariosResult = ScenarioController.getAllScenarios();
        if (scenariosResult.success) {
          totalScenarios = scenariosResult.data.length;
        }
      }
      
      if (totalScenarios === 0) {
        return { success: true, data: 0, error: null };
      }
      
      // Busca cenários completados pelo utilizador
      var completedScenarios = 0;
      if (typeof ResultController !== 'undefined' && ResultController.getResultsByUser) {
        var resultsResult = ResultController.getResultsByUser(userId);
        if (resultsResult.success) {
          // Conta cenários únicos (mesmo cenário pode ter múltiplas tentativas)
          var uniqueScenarios = {};
          resultsResult.data.forEach(function(result) {
            uniqueScenarios[result.ScenarioID] = true;
          });
          completedScenarios = Object.keys(uniqueScenarios).length;
        }
      }
      
      var rate = Math.round((completedScenarios / totalScenarios) * 100);
      
      return { success: true, data: rate, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    getProfile: getProfile,
    updateProfile: updateProfile,
    setPreferredDomains: setPreferredDomains,
    getProgress: getProgress,
    updateAvatar: updateAvatar,
    getStatistics: getStatistics,
    setNotificationPreferences: setNotificationPreferences,
    getCompletionRate: getCompletionRate
  };
})();
