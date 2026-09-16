/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — AnalyticsService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Análise agregada de dados. Processa dados de múltiplos utilizadores para gerar estatísticas de turma, escola e sistema.
 *
 * FUNCIONALIDADES:
 *   • getSystemStatistics() — Estatísticas globais.
   • getClassroomAnalytics(classId) — Análise de turma.
   • getSchoolAnalytics(schoolId) — Análise institucional.
   • getVocationPopularity() — Vocações mais recomendadas.
   • getDimensionDistribution() — Distribuição de vectores.
   • getEngagementMetrics() — Métricas de engajamento.
   • getTrendAnalysis(timeframe) — Tendências temporais.
 *
 * INTEGRAÇÕES:
 *   • SpreadsheetApp — múltiplas abas.
   • UserController — dados de utilizadores.
   • VocationController — catálogo de vocações.
   • CacheService — cache de análises pesadas.
 * Aggregation pipeline — processamento em lote.
   Temporal analysis — tendências ao longo do tempo.
   Cache-heavy — análises complexas cacheadas.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const AnalyticsService = (function () {

  var CACHE_TTL = 1800; // 30 minutos

  function getSystemStatistics() {
    try {
      var cacheKey = 'analytics:system:stats';
      
      if (typeof AppCacheService !== 'undefined') {
        var cached = AppCacheService.get(cacheKey);
        if (cached.success && cached.data) {
          return { success: true, data: cached.data, error: null };
        }
      }
      
      var usersResult = Utils.getAllRows('Users');
      var resultsResult = Utils.getAllRows('Results');
      var scenariosResult = ScenarioController.getAllScenarios();
      var vocationsResult = VocationController.getAllVocations();
      
      var stats = {
        totalUsers: usersResult.success ? usersResult.data.length : 0,
        activeUsers: usersResult.success ? usersResult.data.filter(function(u) { return u.Status === 'active'; }).length : 0,
        totalResults: resultsResult.success ? resultsResult.data.length : 0,
        totalScenarios: scenariosResult.success ? scenariosResult.data.length : 0,
        totalVocations: vocationsResult.success ? vocationsResult.data.length : 0,
        avgCompletionRate: 0,
        timestamp: Utils.getTimestamp()
      };
      
      if (usersResult.success && resultsResult.success && usersResult.data.length > 0) {
        var usersWithResults = {};
        resultsResult.data.forEach(function(r) {
          usersWithResults[r.UserID] = true;
        });
        stats.avgCompletionRate = Math.round((Object.keys(usersWithResults).length / usersResult.data.length) * 100);
      }
      
      if (typeof AppCacheService !== 'undefined') {
        AppCacheService.put(cacheKey, stats, CACHE_TTL);
      }
      
      return { success: true, data: stats, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getVocationPopularity() {
    try {
      var cacheKey = 'analytics:vocation:popularity';
      
      if (typeof AppCacheService !== 'undefined') {
        var cached = AppCacheService.get(cacheKey);
        if (cached.success && cached.data) {
          return { success: true, data: cached.data, error: null };
        }
      }
      
      var resultsResult = Utils.getAllRows('Results');
      if (!resultsResult.success) return resultsResult;
      
      var vocationCounts = {};
      resultsResult.data.forEach(function(result) {
        var vocId = result.VocationID;
        if (vocId) {
          vocationCounts[vocId] = (vocationCounts[vocId] || 0) + 1;
        }
      });
      
      var popularity = Object.keys(vocationCounts).map(function(vocId) {
        var vocationResult = VocationController.getVocationById(vocId);
        return {
          vocationId: vocId,
          vocationName: vocationResult.success ? vocationResult.data.Title : vocId,
          domain: vocationResult.success ? vocationResult.data.Domain : 'Unknown',
          count: vocationCounts[vocId],
          percentage: Math.round((vocationCounts[vocId] / resultsResult.data.length) * 100)
        };
      }).sort(function(a, b) {
        return b.count - a.count;
      });
      
      if (typeof AppCacheService !== 'undefined') {
        AppCacheService.put(cacheKey, popularity, CACHE_TTL);
      }
      
      return { success: true, data: popularity, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function getDimensionDistribution() {
    try {
      var cacheKey = 'analytics:dimension:distribution';
      
      if (typeof AppCacheService !== 'undefined') {
        var cached = AppCacheService.get(cacheKey);
        if (cached.success && cached.data) {
          return { success: true, data: cached.data, error: null };
        }
      }
      
      var dimensionsResult = Utils.getAllRows('UserDimensions');
      if (!dimensionsResult.success) return dimensionsResult;
      
      var DIMENSION_KEYS = ['IA', 'FIL', 'PSI', 'NEU', 'BIO', 'FIS', 'SOC', 'ART'];
      var sums = {};
      var counts = {};
      
      DIMENSION_KEYS.forEach(function(key) {
        sums[key] = 0;
        counts[key] = 0;
      });
      
      dimensionsResult.data.forEach(function(row) {
        DIMENSION_KEYS.forEach(function(key) {
          var value = Number(row[key] || 0);
          if (value > 0) {
            sums[key] += value;
            counts[key]++;
          }
        });
      });
      
      var distribution = DIMENSION_KEYS.map(function(key) {
        return {
          dimension: key,
          average: counts[key] > 0 ? Math.round(sums[key] / counts[key]) : 0,
          total: sums[key],
          userCount: counts[key]
        };
      }).sort(function(a, b) {
        return b.average - a.average;
      });
      
      if (typeof AppCacheService !== 'undefined') {
        AppCacheService.put(cacheKey, distribution, CACHE_TTL);
      }
      
      return { success: true, data: distribution, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function getEngagementMetrics() {
    try {
      var usersResult = Utils.getAllRows('Users');
      var resultsResult = Utils.getAllRows('Results');
      var logsResult = Utils.getAllRows('Logs');
      
      if (!usersResult.success || !resultsResult.success) {
        return { success: false, data: null, error: 'Erro ao buscar dados.' };
      }
      
      var now = new Date();
      var last30Days = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      
      var activeUsersLast30Days = 0;
      if (logsResult.success) {
        var activeUserIds = {};
        logsResult.data.forEach(function(log) {
          var logDate = new Date(log.Timestamp);
          if (logDate >= last30Days && log.Actor) {
            activeUserIds[log.Actor] = true;
          }
        });
        activeUsersLast30Days = Object.keys(activeUserIds).length;
      }
      
      var resultsLast30Days = resultsResult.data.filter(function(r) {
        var resultDate = new Date(r.CompletedAt);
        return resultDate >= last30Days;
      }).length;
      
      var avgScenariosPerUser = resultsResult.data.length / Math.max(usersResult.data.length, 1);
      
      return {
        success: true,
        data: {
          totalUsers: usersResult.data.length,
          activeUsersLast30Days: activeUsersLast30Days,
          totalResults: resultsResult.data.length,
          resultsLast30Days: resultsLast30Days,
          avgScenariosPerUser: Math.round(avgScenariosPerUser * 10) / 10,
          engagementRate: Math.round((activeUsersLast30Days / Math.max(usersResult.data.length, 1)) * 100)
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function buildGroupAnalytics_(scopeField, scopeId) {
    var normalizedId = String(scopeId || '').trim();
    if (!normalizedId || normalizedId.length > 120) {
      return { success: false, data: null, error: 'Identificador do grupo inválido.' };
    }
    var usersResult = Utils.getAllRows('Users');
    var resultsResult = Utils.getAllRows('Results');
    if (!usersResult.success) return usersResult;
    if (!resultsResult.success) return resultsResult;

    var users = usersResult.data.filter(function(user) {
      return String(user[scopeField] || '') === normalizedId;
    });
    var userIds = {};
    users.forEach(function(user) { userIds[String(user.UserID)] = true; });
    var results = resultsResult.data.filter(function(result) {
      return userIds[String(result.UserID)] === true;
    });
    var participantIds = {};
    var scores = [];
    var domains = {};
    var vocations = {};
    results.forEach(function(result) {
      participantIds[String(result.UserID)] = true;
      var rawScore = result.Score !== null && result.Score !== undefined && result.Score !== ''
        ? result.Score
        : result.Compatibility;
      var score = Number(rawScore);
      if (isFinite(score)) scores.push(score);
      var domain = String(result.Domain || 'Não informado');
      var vocation = String(result.RecommendedVocation || result.VocationID || 'Não informada');
      domains[domain] = (domains[domain] || 0) + 1;
      vocations[vocation] = (vocations[vocation] || 0) + 1;
    });
    scores.sort(function(a, b) { return a - b; });
    var middle = Math.floor(scores.length / 2);
    var median = scores.length
      ? (scores.length % 2 ? scores[middle] : (scores[middle - 1] + scores[middle]) / 2)
      : 0;
    var sum = scores.reduce(function(total, score) { return total + score; }, 0);
    function ranking(source) {
      return Object.keys(source).map(function(label) {
        return { label: label, count: source[label] };
      }).sort(function(a, b) { return b.count - a.count || a.label.localeCompare(b.label); });
    }

    return {
      success: true,
      data: {
        scopeId: normalizedId,
        scopeField: scopeField,
        totalUsers: users.length,
        activeUsers: users.filter(function(user) { return String(user.Status).toLowerCase() === 'active'; }).length,
        participants: Object.keys(participantIds).length,
        totalResults: results.length,
        participationRate: users.length ? Math.round(Object.keys(participantIds).length / users.length * 100) : 0,
        averageScore: scores.length ? Math.round(sum / scores.length * 10) / 10 : 0,
        medianScore: Math.round(median * 10) / 10,
        domainDistribution: ranking(domains),
        vocationPopularity: ranking(vocations),
        generatedAt: Utils.getTimestamp()
      },
      error: null
    };
  }

  function getClassroomAnalytics(classId) {
    try {
      return buildGroupAnalytics_('ClassID', classId);
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getSchoolAnalytics(schoolId) {
    try {
      return buildGroupAnalytics_('SchoolID', schoolId);
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getTrendAnalysis(timeframe) {
    try {
      var days = Number(timeframe || 30);
      var resultsResult = Utils.getAllRows('Results');
      if (!resultsResult.success) return resultsResult;
      
      var now = new Date();
      var startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
      
      var dailyCounts = {};
      
      resultsResult.data.forEach(function(result) {
        var date = new Date(result.CompletedAt);
        if (date >= startDate) {
          var dayKey = date.toISOString().split('T')[0];
          dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;
        }
      });
      
      var trend = Object.keys(dailyCounts).sort().map(function(date) {
        return {
          date: date,
          count: dailyCounts[date]
        };
      });
      
      return { success: true, data: trend, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  return {
    getSystemStatistics: getSystemStatistics,
    getClassroomAnalytics: getClassroomAnalytics,
    getSchoolAnalytics: getSchoolAnalytics,
    getVocationPopularity: getVocationPopularity,
    getDimensionDistribution: getDimensionDistribution,
    getEngagementMetrics: getEngagementMetrics,
    getTrendAnalysis: getTrendAnalysis
  };
})();
