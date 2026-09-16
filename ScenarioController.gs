/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — ScenarioController.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Controlador CRUD para a entidade Cenários. Gerencia desafios sociotécnicos com categoria, dificuldade e critérios de avaliação psicométrica.
 *
 * FUNCIONALIDADES:
 *   • createScenario(data) — Cria cenário (create).
   • getAllScenarios() — Lista todos (read).
   • getScenarioById(id) — Busca por ID (read).
   • updateScenario(id, data) — Atualiza (update).
   • deleteScenario(id) — Soft delete.
   • getScenariosByCategory(category) — Filtra por categoria (read).
   • getScenariosByDifficulty(level) — Filtra por dificuldade (read).
   • getRandomScenario(excludeIds) — Cenário aleatório.
   • getNextScenario(userId) — Próximo na progressão.
 *
 * INTEGRAÇÕES:
 *   • SpreadsheetApp — aba Scenarios.
   • ScenarioCategoryService — categorias.
   • ScenarioDifficultyService — dificuldades.
   • CacheService — cache de cenários.
   • LoggerService — registro CRUD.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ScenarioController = (function () {

  var DIFFICULTY_LEVELS = ['easy', 'medium', 'hard', 'expert'];

  function _cleanText(value) {
    var raw = String(value === null || value === undefined ? '' : value).trim();
    try {
      if (typeof SanitizeService !== 'undefined' && SanitizeService.stripScripts && SanitizeService.sanitizeHTML) {
        // Escapa marcação sem compactar quebras de linha da narrativa.
        var scripts = SanitizeService.stripScripts(raw);
        var result = SanitizeService.sanitizeHTML(scripts.success ? scripts.data : raw);
        if (result.success) return result.data;
      } else if (typeof SanitizeService !== 'undefined' && SanitizeService.cleanInput) {
        var fallback = SanitizeService.cleanInput(raw);
        if (fallback.success) return fallback.data;
      }
    } catch (err) {
      // Sanitização é complementada pela validação de tamanho abaixo.
    }
    return raw;
  }

  function _difficulty(value) {
    var normalized = String(value === null || value === undefined ? 'medium' : value).trim().toLowerCase();
    if (/^[1-4]$/.test(normalized)) return DIFFICULTY_LEVELS[Number(normalized) - 1];
    return normalized;
  }

  function _status(value) {
    if (value === true) return 'active';
    if (value === false) return 'inactive';
    return String(value === null || value === undefined ? 'active' : value).trim().toLowerCase();
  }

  function _validateScenario(data) {
    if (!data.Title || data.Title.length < 3) {
      return { success: false, data: null, error: 'Título do cenário é obrigatório (mín. 3 caracteres).' };
    }
    if (data.Title.length > 200) {
      return { success: false, data: null, error: 'Título do cenário muito longo (máx. 200 caracteres).' };
    }
    if (data.Description && data.Description.length > 6000) {
      return { success: false, data: null, error: 'Narrativa muito longa (máx. 6000 caracteres).' };
    }
    if (data.Narrative && data.Narrative.length > 6000) {
      return { success: false, data: null, error: 'Narrativa muito longa (máx. 6000 caracteres).' };
    }
    if (DIFFICULTY_LEVELS.indexOf(data.Difficulty) === -1) {
      return { success: false, data: null, error: 'Dificuldade inválida. Use: easy, medium, hard ou expert.' };
    }
    if (['active', 'inactive'].indexOf(data.Status) === -1) {
      return { success: false, data: null, error: 'Status do cenário inválido.' };
    }
    return { success: true, data: true, error: null };
  }

  function _logCRUD(action, scenarioId, actorId) {
    try {
      if (typeof LoggerService !== 'undefined' && LoggerService.logCRUD) {
        LoggerService.logCRUD('Scenarios', action, scenarioId, actorId);
      }
    } catch (err) {
      // Auditoria é auxiliar
    }
  }

  function createScenario(data) {
    data = data || {};
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      
      var scenarioId = Utils.generateId();
      var title = _cleanText(data.title);
      var description = _cleanText(data.description);
      var narrative = _cleanText(data.narrative || data.Narrative || data.description);
      var difficulty = _difficulty(data.difficulty);
      var status = _status(data.status);
      var scenarioData = {
        ScenarioID: scenarioId,
        Title: title,
        Description: description,
        Narrative: narrative,
        Category: _cleanText(data.category || 'general').toLowerCase(),
        Difficulty: difficulty,
        Criteria: _cleanText(data.criteria || data.Criteria),
        EvaluationCriteria: _cleanText(data.evaluationCriteria || data.EvaluationCriteria),
        Status: status,
        CreatedAt: Utils.getTimestamp(),
        UpdatedAt: Utils.getTimestamp(),
        CreatedBy: _cleanText(data.createdBy || 'system')
      };

      var validation = _validateScenario(scenarioData);
      if (!validation.success) return validation;
      
      var result = Utils.addRow('Scenarios', scenarioData);
      if (!result.success) return result;
      
      _logCRUD('CREATE', scenarioId, scenarioData.CreatedBy);
      
      return { success: true, data: { scenarioId: scenarioId }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function getAllScenarios() {
    try {
      var result = Utils.getAllRows('Scenarios');
      if (!result.success) return result;
      return { success: true, data: result.data, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function getScenarioById(scenarioId) {
    try {
      var result = Utils.getAllRows('Scenarios');
      if (!result.success) return result;
      
      var scenario = result.data.filter(function(s) {
        return String(s.ScenarioID || '').trim() === String(scenarioId || '').trim();
      })[0];
      
      if (!scenario) {
        return { success: false, data: null, error: 'Cenário não encontrado.' };
      }
      
      return { success: true, data: scenario, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function updateScenario(scenarioId, data) {
    data = data || {};
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('Scenarios');
      if (!sheet) return { success: false, data: null, error: 'Aba Scenarios não encontrada.' };
      
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var idCol = headers.indexOf('ScenarioID');
      if (idCol === -1) return { success: false, data: null, error: 'Coluna ScenarioID não encontrada.' };
      
      var rowIndex = -1;
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][idCol] || '').trim() === String(scenarioId || '').trim()) {
          rowIndex = i;
          break;
        }
      }
      if (rowIndex === -1) {
        return { success: false, data: null, error: 'Cenário não encontrado.' };
      }
      
      var current = {};
      headers.forEach(function(field, index) { current[field] = values[rowIndex][index]; });
      var candidate = {
        Title: current.Title,
        Description: current.Description,
        Narrative: current.Narrative,
        Difficulty: _difficulty(current.Difficulty),
        Status: _status(current.Status)
      };
      var updatableFields = ['Title', 'Description', 'Narrative', 'Category', 'Difficulty', 'Criteria', 'EvaluationCriteria', 'Status'];
      updatableFields.forEach(function(field) {
        var colIndex = headers.indexOf(field);
        var lower = field.charAt(0).toLowerCase() + field.slice(1);
        var value = data[field] !== undefined ? data[field] : data[lower];
        if (colIndex !== -1 && value !== undefined) {
          if (field === 'Difficulty') value = _difficulty(value);
          else if (field === 'Status') value = _status(value);
          else if (['Title', 'Description', 'Narrative', 'Category', 'Criteria', 'EvaluationCriteria'].indexOf(field) !== -1) value = _cleanText(value);
          values[rowIndex][colIndex] = value;
          if (candidate[field] !== undefined || ['Title', 'Description', 'Narrative', 'Difficulty', 'Status'].indexOf(field) !== -1) candidate[field] = value;
        }
      });

      var validation = _validateScenario(candidate);
      if (!validation.success) return validation;
      
      var updatedAtCol = headers.indexOf('UpdatedAt');
      if (updatedAtCol !== -1) {
        values[rowIndex][updatedAtCol] = Utils.getTimestamp();
      }
      
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      _logCRUD('UPDATE', scenarioId, data.actorId || 'system');
      
      return { success: true, data: { scenarioId: scenarioId }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function deleteScenario(scenarioId) {
    return updateScenario(scenarioId, { Status: 'inactive', actorId: 'system' });
  }

  function getScenariosByCategory(category) {
    try {
      var result = getAllScenarios();
      if (!result.success) return result;
      
      var filtered = result.data.filter(function(scenario) {
        return String(scenario.Category || '').toLowerCase() === String(category || '').toLowerCase();
      });
      
      return { success: true, data: filtered, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function getScenariosByDifficulty(level) {
    try {
      var result = getAllScenarios();
      if (!result.success) return result;
      var wanted = _difficulty(level);
      var filtered = result.data.filter(function(scenario) {
        return _difficulty(scenario.Difficulty) === wanted;
      });
      
      return { success: true, data: filtered, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function getRandomScenario(excludeIds) {
    try {
      var result = getAllScenarios();
      if (!result.success) return result;
      
      var excludeList = Array.isArray(excludeIds) ? excludeIds.map(function(id) { return String(id); }) : [];
      var available = result.data.filter(function(scenario) {
        return _status(scenario.Status) === 'active' && excludeList.indexOf(String(scenario.ScenarioID)) === -1;
      });
      
      if (available.length === 0) {
        return { success: false, data: null, error: 'Nenhum cenário disponível.' };
      }
      
      var randomIndex = Math.floor(Math.random() * available.length);
      return { success: true, data: available[randomIndex], error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getNextScenario(userId) {
    try {
      // Busca cenários ainda não completados pelo utilizador
      var resultResult = Utils.getAllRows('Results');
      var completedIds = [];
      
      if (resultResult.success) {
        completedIds = resultResult.data
          .filter(function(r) { return String(r.UserID || '').trim() === String(userId || '').trim(); })
          .map(function(r) { return String(r.ScenarioID || ''); });
      }
      
      return getRandomScenario(completedIds);
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    createScenario: createScenario,
    getAllScenarios: getAllScenarios,
    getScenarioById: getScenarioById,
    updateScenario: updateScenario,
    deleteScenario: deleteScenario,
    getScenariosByCategory: getScenariosByCategory,
    getScenariosByDifficulty: getScenariosByDifficulty,
    getRandomScenario: getRandomScenario,
    getNextScenario: getNextScenario
  };
})();
