/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — DimensionController.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Controlador CRUD para gestão de vectores psicométricos de utilizadores.
 *   Interface entre frontend e DimensionService para operações administrativas
 *   e consultas sobre as 8 dimensões fundamentais (IA, FIL, PSI, NEU, BIO, FIS, SOC, ART).
 *
 * FUNCIONALIDADES:
 *   • createDimension(userId) — Inicializa vectores zerados para novo utilizador.
 *   • getDimension(userId) — Retorna vectores brutos (read).
 *   • updateDimension(userId, data) — Atualiza vectores (update).
 *   • getAllDimensions() — Lista todos os utilizadores com dimensões (read).
 *   • getDimensionHistory(userId) — Histórico de evolução via resultados.
 *   • normalizeDimension(userId) — Retorna vectores normalizados (soma=1).
 *   • resetDimension(userId) — Reseta vectores para estado inicial.
 *   • getDimensionComparison(userId1, userId2) — Compara vectores entre utilizadores.
 *   • exportDimensionsCSV(userId) — Exporta dimensões em formato CSV.
 *
 * INTEGRAÇÕES:
 *   • Utils — acesso em lote à aba UserDimensions.
 *   • DimensionService — cálculos e normalização de vectores.
 *   • InteractionService — atualização automática via poções.
 *   • AppCacheService — cache de vectores para performance.
 *   • LoggerService — auditoria de operações administrativas.
 *
 * COLUNA DA PLANILHA (UserDimensions):
 *   UserID | IA | FIL | PSI | NEU | BIO | FIS | SOC | ART | UpdatedAt
 *
 * PADRÕES:
 *   Batch read — Utils.getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *   Cache-friendly — usa cache para consultas frequentes.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const DimensionController = (function () {

  var DIMENSION_KEYS = ['IA', 'FIL', 'PSI', 'NEU', 'BIO', 'FIS', 'SOC', 'ART'];
  var CACHE_TTL = 1800; // 30 minutos

  function _audit(action, details) {
    try {
      if (typeof LoggerService !== 'undefined' && LoggerService.log) {
        LoggerService.log('DIMENSION', action, details);
      }
    } catch (err) {
      // Auditoria é auxiliar.
    }
  }

  function _invalidateCache(userId) {
    try {
      if (typeof AppCacheService !== 'undefined') {
        AppCacheService.remove('dimension_' + userId);
      }
    } catch (err) {
      // Cache é opcional.
    }
  }

  function createDimension(userId) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    
    try {
      // Verifica se já existe
      var existing = getDimension(userId);
      if (existing.success && existing.data !== null) {
        return { success: false, data: null, error: 'Dimensões já existem para este utilizador.' };
      }
      
      // Cria vectores zerados
      var initialDimensions = { UserID: userId, UpdatedAt: Utils.getTimestamp() };
      DIMENSION_KEYS.forEach(function(key) {
        initialDimensions[key] = 0;
      });
      
      var result = Utils.addRow('UserDimensions', initialDimensions);
      if (result.success) {
        _audit('DIMENSION_CREATE', userId);
      }
      
      return result;
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getDimension(userId) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    
    try {
      // Tenta cache primeiro
      if (typeof AppCacheService !== 'undefined') {
        var cached = AppCacheService.get('dimension_' + userId);
        if (cached.success && cached.data !== null) {
          return { success: true, data: cached.data, error: null };
        }
      }
      
      var result = DimensionService.getAggregateVector(userId);
      
      // Cacheia se bem-sucedido
      if (result.success && result.data && typeof AppCacheService !== 'undefined') {
        AppCacheService.put('dimension_' + userId, result.data, CACHE_TTL);
      }
      
      return result;
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function updateDimension(userId, data) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    if (!data || typeof data !== 'object') {
      return { success: false, data: null, error: 'Dados de dimensões são obrigatórios.' };
    }
    
    try {
      // Valida que pelo menos uma dimensão foi fornecida
      var hasValidDimension = DIMENSION_KEYS.some(function(key) {
        return data[key] !== undefined && !isNaN(Number(data[key]));
      });
      
      if (!hasValidDimension) {
        return { success: false, data: null, error: 'Nenhuma dimensão válida fornecida.' };
      }
      
      var result = DimensionService.updateUserDimensions(userId, data);
      
      if (result.success) {
        _invalidateCache(userId);
        _audit('DIMENSION_UPDATE', userId);
      }
      
      return result;
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getAllDimensions() {
    try {
      var result = Utils.getAllRows('UserDimensions');
      if (!result.success) return result;
      
      var dimensions = result.data.map(function(row) {
        var dims = { userId: row.UserID, updatedAt: row.UpdatedAt };
        DIMENSION_KEYS.forEach(function(key) {
          dims[key] = Number(row[key] || 0);
        });
        return dims;
      });
      
      return { success: true, data: dimensions, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getDimensionHistory(userId) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    
    try {
      // Busca histórico através de resultados
      if (typeof ResultController === 'undefined') {
        return { success: false, data: null, error: 'ResultController não disponível.' };
      }
      
      var resultsResult = ResultController.getResultsByUser(userId);
      if (!resultsResult.success) return resultsResult;
      
      var history = resultsResult.data.map(function(result) {
        var dims = {};
        try {
          dims = JSON.parse(result.Dimensions || '{}');
        } catch (err) {
          DIMENSION_KEYS.forEach(function(key) { dims[key] = 0; });
        }
        
        return {
          resultId: result.ResultID,
          scenarioId: result.ScenarioID,
          timestamp: result.SubmittedAt,
          dimensions: dims
        };
      });
      
      return { success: true, data: history, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function normalizeDimension(userId) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    
    try {
      return DimensionService.getDimensionPercentages(userId);
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function resetDimension(userId) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      
      var sheet = Utils.getSheet('UserDimensions');
      if (!sheet) return { success: false, data: null, error: 'Aba UserDimensions não encontrada.' };
      
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
        return { success: false, data: null, error: 'Dimensões não encontradas para este utilizador.' };
      }
      
      // Reseta todas as dimensões para 0
      DIMENSION_KEYS.forEach(function(key) {
        var colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          values[rowIndex][colIndex] = 0;
        }
      });
      
      var updatedAtCol = headers.indexOf('UpdatedAt');
      if (updatedAtCol !== -1) {
        values[rowIndex][updatedAtCol] = Utils.getTimestamp();
      }
      
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      
      _invalidateCache(userId);
      _audit('DIMENSION_RESET', userId);
      
      return { success: true, data: { userId: userId, reset: true }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function getDimensionComparison(userId1, userId2) {
    if (!userId1 || !userId2) {
      return { success: false, data: null, error: 'Dois UserIDs são obrigatórios.' };
    }
    
    try {
      var dims1 = getDimension(userId1);
      var dims2 = getDimension(userId2);
      
      if (!dims1.success || !dims2.success) {
        return { success: false, data: null, error: 'Erro ao buscar dimensões dos utilizadores.' };
      }
      
      var compatibility = DimensionService.calculateCompatibility(dims1.data, dims2.data);
      
      var comparison = {
        user1: { userId: userId1, dimensions: dims1.data },
        user2: { userId: userId2, dimensions: dims2.data },
        compatibility: compatibility.data || 0,
        differences: {}
      };
      
      // Calcula diferenças por dimensão
      DIMENSION_KEYS.forEach(function(key) {
        comparison.differences[key] = dims1.data[key] - dims2.data[key];
      });
      
      return { success: true, data: comparison, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function exportDimensionsCSV(userId) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    
    try {
      var dimension = getDimension(userId);
      if (!dimension.success) return dimension;
      
      var normalized = normalizeDimension(userId);
      if (!normalized.success) return normalized;
      
      var csv = 'Dimensao,Valor Bruto,Percentagem\n';
      
      DIMENSION_KEYS.forEach(function(key) {
        var raw = dimension.data[key] || 0;
        var pct = ((normalized.data[key] || 0) * 100).toFixed(2);
        csv += key + ',' + raw + ',' + pct + '%\n';
      });
      
      return { success: true, data: csv, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    createDimension: createDimension,
    getDimension: getDimension,
    updateDimension: updateDimension,
    getAllDimensions: getAllDimensions,
    getDimensionHistory: getDimensionHistory,
    normalizeDimension: normalizeDimension,
    resetDimension: resetDimension,
    getDimensionComparison: getDimensionComparison,
    exportDimensionsCSV: exportDimensionsCSV
  };
})();
