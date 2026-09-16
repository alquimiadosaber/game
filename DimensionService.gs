/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — DimensionService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Cálculo e manipulação de vectores psicométricos. Implementa atualização, normalização e cálculo de compatibilidade com fórmulas epistémicas.
 *
 * FUNCIONALIDADES:
 *   • updateUserDimensions(userId, delta) — Atualiza vectores.
   • normalize(dimensions) — Normaliza (soma=1).
   • calculateCompatibility(userDims, formulaDims) — Compatibilidade %.
   • getAggregateVector(userId) — Vector agregado.
   • getDimensionPercentages(userId) — Percentagens.
   • accumulateDimensions(userId, deltas) — Acumula variações.
   • getDimensionTrend(userId) — Tendência de evolução.
 *
 * INTEGRAÇÕES:
 *   • DimensionController — leitura/escrita na aba.
   • InteractionService — deltas por poções.
   • TaxonomyService — comparação com fórmulas.
   • ResultService — input para matching.
 * Vector arithmetic — operações em vectores multidimensionais.
   Accumulative model — vectores acumulam ao longo do tempo.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const DimensionService = (function () {

  var DIMENSION_KEYS = ['IA', 'FIL', 'PSI', 'NEU', 'BIO', 'FIS', 'SOC', 'ART'];

  function _ensureAllDimensions(dims) {
    var result = {};
    DIMENSION_KEYS.forEach(function(key) {
      result[key] = Number(dims[key] || 0);
    });
    return result;
  }

  function _getUserDimensionsRow(userId) {
    var result = Utils.getAllRows('UserDimensions');
    if (!result.success) return null;
    
    return result.data.filter(function(row) {
      return row.UserID === userId;
    })[0] || null;
  }

  function normalize(dimensions) {
    try {
      var dims = _ensureAllDimensions(dimensions);
      var total = 0;
      
      DIMENSION_KEYS.forEach(function(key) {
        total += dims[key];
      });
      
      if (total === 0) {
        return { success: false, data: null, error: 'Soma das dimensões não pode ser zero.' };
      }
      
      var normalized = {};
      DIMENSION_KEYS.forEach(function(key) {
        normalized[key] = dims[key] / total;
      });
      
      return { success: true, data: normalized, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function calculateCompatibility(userDims, formulaDims) {
    try {
      var user = _ensureAllDimensions(userDims);
      var formula = _ensureAllDimensions(formulaDims);
      
      // Normaliza ambos os vectores
      var userNorm = normalize(user);
      var formulaNorm = normalize(formula);
      
      if (!userNorm.success || !formulaNorm.success) {
        return { success: false, data: 0, error: 'Erro ao normalizar vectores.' };
      }
      
      // Calcula distância euclidiana
      var sumSquares = 0;
      DIMENSION_KEYS.forEach(function(key) {
        var diff = userNorm.data[key] - formulaNorm.data[key];
        sumSquares += diff * diff;
      });
      
      var distance = Math.sqrt(sumSquares);
      
      // Converte distância para compatibilidade (0-1, onde 0=perfeito)
      // Distância máxima possível ≈ √2 para vectores normalizados
      var compatibility = Math.max(0, 1 - (distance / Math.sqrt(2)));
      
      return { success: true, data: compatibility * 100, error: null };
    } catch (err) {
      return { success: false, data: 0, error: err.message };
    }
  }

  function getAggregateVector(userId) {
    try {
      var row = _getUserDimensionsRow(userId);
      if (!row) {
        // Retorna vector vazio se utilizador não tem dimensões ainda
        var empty = {};
        DIMENSION_KEYS.forEach(function(key) { empty[key] = 0; });
        return { success: true, data: empty, error: null };
      }
      
      var vector = {};
      DIMENSION_KEYS.forEach(function(key) {
        vector[key] = Number(row[key] || 0);
      });
      
      return { success: true, data: vector, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getDimensionPercentages(userId) {
    try {
      var vectorResult = getAggregateVector(userId);
      if (!vectorResult.success) return vectorResult;
      
      return normalize(vectorResult.data);
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function updateUserDimensions(userId, delta) {
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
      
      // Se não existe, cria nova linha
      if (rowIndex === -1) {
        var newRow = {};
        newRow.UserID = userId;
        newRow.UpdatedAt = Utils.getTimestamp();
        DIMENSION_KEYS.forEach(function(key) {
          newRow[key] = Number(delta[key] || 0);
        });
        var newValues = headers.map(function(header) {
          return Object.prototype.hasOwnProperty.call(newRow, header) ? newRow[header] : '';
        });
        sheet.getRange(values.length + 1, 1, 1, headers.length).setValues([newValues]);
        return { success: true, data: newRow, error: null };
      }
      
      // Atualiza dimensões existentes
      DIMENSION_KEYS.forEach(function(key) {
        var colIndex = headers.indexOf(key);
        if (colIndex !== -1 && delta[key] !== undefined) {
          var current = Number(values[rowIndex][colIndex] || 0);
          values[rowIndex][colIndex] = current + Number(delta[key]);
        }
      });
      
      var updatedAtCol = headers.indexOf('UpdatedAt');
      if (updatedAtCol !== -1) {
        values[rowIndex][updatedAtCol] = Utils.getTimestamp();
      }
      
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      
      var updated = {};
      DIMENSION_KEYS.forEach(function(key) {
        var colIndex = headers.indexOf(key);
        updated[key] = colIndex !== -1 ? values[rowIndex][colIndex] : 0;
      });
      
      return { success: true, data: updated, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function accumulateDimensions(userId, deltas) {
    try {
      if (!Array.isArray(deltas) || deltas.length === 0) {
        return { success: false, data: null, error: 'Deltas deve ser array não vazio.' };
      }
      
      // Soma todos os deltas
      var totalDelta = {};
      DIMENSION_KEYS.forEach(function(key) {
        totalDelta[key] = 0;
      });
      
      deltas.forEach(function(delta) {
        DIMENSION_KEYS.forEach(function(key) {
          totalDelta[key] += Number(delta[key] || 0);
        });
      });
      
      // Aplica acumulado de uma vez
      return updateUserDimensions(userId, totalDelta);
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getDimensionTrend(userId) {
    try {
      // Busca histórico de resultados para análise de tendência
      if (typeof ResultController === 'undefined') {
        return { success: false, data: null, error: 'ResultController não disponível.' };
      }
      
      var resultsResult = ResultController.getResultsByUser(userId);
      if (!resultsResult.success || resultsResult.data.length < 2) {
        return { success: false, data: null, error: 'Histórico insuficiente para análise de tendência.' };
      }
      
      var results = resultsResult.data;
      var oldest = results[results.length - 1];
      var newest = results[0];
      
      // Parse dimensions de oldest e newest
      var oldDims = {};
      var newDims = {};
      
      try {
        oldDims = JSON.parse(oldest.Dimensions || '{}');
        newDims = JSON.parse(newest.Dimensions || '{}');
      } catch (err) {
        return { success: false, data: null, error: 'Erro ao processar dimensões.' };
      }
      
      // Calcula variação
      var trend = {};
      DIMENSION_KEYS.forEach(function(key) {
        var oldVal = Number(oldDims[key] || 0);
        var newVal = Number(newDims[key] || 0);
        trend[key] = newVal - oldVal;
      });
      
      return { success: true, data: trend, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    updateUserDimensions: updateUserDimensions,
    normalize: normalize,
    calculateCompatibility: calculateCompatibility,
    getAggregateVector: getAggregateVector,
    getDimensionPercentages: getDimensionPercentages,
    accumulateDimensions: accumulateDimensions,
    getDimensionTrend: getDimensionTrend
  };
})();
