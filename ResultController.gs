/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — ResultController.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Controlador CRUD para Resultados. Gerencia resultados vocacionais finais de cada utilizador após completar o simulador.
 *
 * FUNCIONALIDADES:
 *   • createResult(data) — Cria resultado (create).
   • getAllResults() — Lista todos (read).
   • getResultById(id) — Busca por ID (read).
   • getResultsByUser(userId) — Resultados do utilizador (read).
   • updateResult(id, data) — Atualiza (update).
   • deleteResult(id) — Remove (delete).
   • getLatestResult(userId) — Resultado mais recente.
 *
 * INTEGRAÇÕES:
 *   • SpreadsheetApp — aba Results.
   • ResultService — algoritmo de matching.
   • TaxonomyService — mapeamento epistémico.
   • VocationController — catálogo de vocações.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ResultController = (function () {

  function _logCRUD(action, resultId, actorId) {
    try {
      if (typeof LoggerService !== 'undefined' && LoggerService.logCRUD) {
        LoggerService.logCRUD('Results', action, resultId, actorId);
      }
    } catch (err) {
      // Auditoria é auxiliar
    }
  }

  function createResult(data) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      
      var resultId = Utils.generateId();
      var resultData = {
        ResultID: resultId,
        UserID: String(data.userId || ''),
        ScenarioID: String(data.scenarioId || ''),
        VocationID: String(data.vocationId || ''),
        RecommendedVocation: String(data.recommendedVocation || data.vocationTitle || ''),
        Compatibility: Number(data.compatibility !== undefined ? data.compatibility : data.score || 0),
        Score: Number(data.score || 0),
        Dimensions: String(data.dimensions || ''),
        Domain: String(data.domain || ''),
        Difficulty: String(data.difficulty || ''),
        SubmittedAt: data.submittedAt || Utils.getTimestamp(),
        CompletedAt: Utils.getTimestamp(),
        Status: String(data.status || 'completed')
      };
      
      if (!resultData.UserID) {
        return { success: false, data: null, error: 'UserID é obrigatório.' };
      }
      
      if (!resultData.VocationID) {
        return { success: false, data: null, error: 'VocationID é obrigatório.' };
      }
      
      var sheet = Utils.getSheet('Results');
      if (!sheet) return { success: false, data: null, error: 'Aba Results não encontrada.' };
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      if (!headers.length) return { success: false, data: null, error: 'Aba Results sem cabeçalho definido.' };
      var row = headers.map(function(header) {
        return Object.prototype.hasOwnProperty.call(resultData, header) ? resultData[header] : '';
      });
      sheet.getRange(values.length + 1, 1, 1, headers.length).setValues([row]);
      
      return { success: true, data: { resultId: resultId }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function getAllResults() {
    try {
      var result = Utils.getAllRows('Results');
      if (!result.success) return result;
      return { success: true, data: result.data, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function getResultById(resultId) {
    try {
      var result = Utils.getAllRows('Results');
      if (!result.success) return result;
      
      var resultData = result.data.filter(function(r) {
        return r.ResultID === resultId;
      })[0];
      
      if (!resultData) {
        return { success: false, data: null, error: 'Resultado não encontrado.' };
      }
      
      return { success: true, data: resultData, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getResultsByUser(userId) {
    try {
      var result = getAllResults();
      if (!result.success) return result;
      
      var filtered = result.data.filter(function(r) {
        return r.UserID === userId;
      });
      
      // Ordena por data decrescente
      filtered.sort(function(a, b) {
        var dateA = new Date(a.CompletedAt || 0);
        var dateB = new Date(b.CompletedAt || 0);
        return dateB - dateA;
      });
      
      return { success: true, data: filtered, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function updateResult(resultId, data) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('Results');
      if (!sheet) return { success: false, data: null, error: 'Aba Results não encontrada.' };
      
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var idCol = headers.indexOf('ResultID');
      if (idCol === -1) return { success: false, data: null, error: 'Coluna ResultID não encontrada.' };
      
      var rowIndex = -1;
      for (var i = 1; i < values.length; i++) {
        if (values[i][idCol] === resultId) {
          rowIndex = i;
          break;
        }
      }
      if (rowIndex === -1) {
        return { success: false, data: null, error: 'Resultado não encontrado.' };
      }
      
      var updatableFields = ['Score', 'Dimensions', 'Status'];
      updatableFields.forEach(function(field) {
        var colIndex = headers.indexOf(field);
        if (colIndex !== -1 && data[field] !== undefined) {
          values[rowIndex][colIndex] = data[field];
        }
      });
      
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      _logCRUD('UPDATE', resultId, data.actorId || 'system');
      
      return { success: true, data: { resultId: resultId }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function deleteResult(resultId) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('Results');
      if (!sheet) return { success: false, data: null, error: 'Aba Results não encontrada.' };
      
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var idCol = headers.indexOf('ResultID');
      if (idCol === -1) return { success: false, data: null, error: 'Coluna ResultID não encontrada.' };
      
      var rowIndex = -1;
      for (var i = 1; i < values.length; i++) {
        if (values[i][idCol] === resultId) {
          rowIndex = i + 1;
          break;
        }
      }
      if (rowIndex === -1) {
        return { success: false, data: null, error: 'Resultado não encontrado.' };
      }
      
      sheet.deleteRow(rowIndex);
      _logCRUD('DELETE', resultId, 'system');
      
      return { success: true, data: { resultId: resultId }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function getLatestResult(userId) {
    try {
      var result = getResultsByUser(userId);
      if (!result.success || result.data.length === 0) {
        return { success: false, data: null, error: 'Nenhum resultado encontrado.' };
      }
      
      return { success: true, data: result.data[0], error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    createResult: createResult,
    getAllResults: getAllResults,
    getResultById: getResultById,
    getResultsByUser: getResultsByUser,
    updateResult: updateResult,
    deleteResult: deleteResult,
    getLatestResult: getLatestResult
  };
})();
