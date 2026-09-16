/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — InteractionController.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Controlador CRUD para Interações. Registra respostas do utilizador aos cenários: barras de controlo (FIL/PSI/IA) e resposta textual livre.
 *
 * FUNCIONALIDADES:
 *   • createInteraction(data) — Registra resposta (create).
   • getAllInteractions() — Lista todas (read).
   • getInteractionsByUser(userId) — Interações do utilizador (read).
   • getInteractionById(id) — Busca por ID (read).
   • updateInteraction(id, data) — Atualiza (update).
   • getInteractionsByScenario(scenarioId) — Interações de cenário (read).
   • getLatestInteraction(userId, scenarioId) — Última interação.
 *
 * INTEGRAÇÕES:
 *   • SpreadsheetApp — aba User_Scenarios.
   • InteractionService — processamento da poção.
   • DimensionService — atualização de vectores.
   • ScoreService — cálculo de pontuação TRI.
   • LLMService — análise semântica.
   • LoggerService — registro de interação.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — {{ success, data, error }}.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const InteractionController = (function () {
  function _ok(data) { return typeof ServiceResult !== 'undefined' ? ServiceResult.ok(data) : { success: true, data: data, error: null }; }
  function _fail(message, fallback) { return typeof ServiceResult !== 'undefined' ? ServiceResult.fail(message, fallback) : { success: false, data: fallback || null, error: message }; }
  function _rows() { return Utils.getAllRows('User_Scenarios'); }
  function _find(id, rows) { return (rows || []).filter(function (row) { return String(row.InteractionID || row.ID) === String(id); })[0] || null; }
  function _log(action, id, actor) { try { if (typeof LoggerService !== 'undefined' && LoggerService.logCRUD) LoggerService.logCRUD('User_Scenarios', action, id, actor || 'system'); } catch (err) {} }
  function _cleanText(value) { var result = typeof SanitizeService !== 'undefined' && SanitizeService.cleanInput ? SanitizeService.cleanInput(value) : _ok(String(value || '').trim()); return result.success ? result.data : ''; }
  function createInteraction(data) {
    data = data || {};
    var userId = String(data.userId || data.UserID || '').trim();
    var scenarioId = String(data.scenarioId || data.ScenarioID || '').trim();
    var filInput = data.fil !== undefined ? data.fil : data.FIL;
    var psiInput = data.psi !== undefined ? data.psi : data.PSI;
    var iaInput = data.ia !== undefined ? data.ia : data.IA;
    if (!userId || !scenarioId) return _fail('UserID e ScenarioID são obrigatórios.');
    var validation = typeof ValidationService !== 'undefined' && ValidationService.validatePotion ? ValidationService.validatePotion(filInput, psiInput, iaInput) : _ok({ fil: Number(filInput), psi: Number(psiInput), ia: Number(iaInput) });
    if (!validation.success) return validation;
    var fil = validation.data.fil;
    var psi = validation.data.psi;
    var ia = validation.data.ia;
    // ✅ CORREÇÃO: Aceitar interactionId pré-gerado (para idempotência)
    var id = data.interactionId || data.InteractionID || 
             (typeof Utils.generateId === 'function' ? Utils.generateId() : String(new Date().getTime()));
    var now = Utils.getTimestamp();
    var row = { InteractionID: id, UserID: userId, ScenarioID: scenarioId, FIL: fil, PSI: psi, IA: ia, FreeText: _cleanText(data.freeText !== undefined ? data.freeText : data.FreeText), CreatedAt: now, UpdatedAt: now, IsActive: true };
    var result = Utils.addRow('User_Scenarios', row);
    if (!result.success) return result;
    // Espelha na aba Interactions (Response = FreeText), que alimenta
    // SemanticAnalyzer (originalidade) e LLMService (resumos). Best-effort:
    // falha aqui não pode invalidar o registro principal em User_Scenarios.
    try {
      Utils.addRow('Interactions', { InteractionID: id, UserID: userId, ScenarioID: scenarioId, Response: row.FreeText, FIL: fil, PSI: psi, IA: ia, CreatedAt: now, UpdatedAt: now, IsActive: true });
    } catch (err) { /* espelho é auxiliar */ }
    _log('CREATE', id, data.actorId);
    return _ok({ interactionId: id, interaction: row });
  }
  function getAllInteractions() { var result = _rows(); return result.success ? _ok(result.data.filter(function (row) { return row.IsActive !== false; })) : _fail(result.error, []); }
  function getInteractionsByUser(userId) { var result = getAllInteractions(); return result.success ? _ok(result.data.filter(function (row) { return String(row.UserID) === String(userId); })) : result; }
  function getInteractionById(id) { var result = getAllInteractions(); if (!result.success) return result; var row = _find(id, result.data); return row ? _ok(row) : _fail('Interação não encontrada.'); }
  function getInteractionsByScenario(scenarioId) { var result = getAllInteractions(); return result.success ? _ok(result.data.filter(function (row) { return String(row.ScenarioID) === String(scenarioId); })) : result; }
  function getLatestInteraction(userId, scenarioId) { var result = getInteractionsByUser(userId); if (!result.success) return result; var rows = result.data.filter(function (row) { return String(row.ScenarioID) === String(scenarioId); }).sort(function (a, b) { return new Date(b.CreatedAt || 0).getTime() - new Date(a.CreatedAt || 0).getTime(); }); return rows.length ? _ok(rows[0]) : _fail('Interação não encontrada.'); }
  function updateInteraction(id, data) {
    data = data || {};
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('User_Scenarios'); if (!sheet) return _fail('Aba User_Scenarios não encontrada.');
      var values = sheet.getDataRange().getValues(); var headers = values[0] || []; var idCol = headers.indexOf('InteractionID'); if (idCol < 0) return _fail('Coluna InteractionID não encontrada.');
      var rowIndex = -1; for (var i = 1; i < values.length; i++) if (String(values[i][idCol] || '').trim() === String(id || '').trim()) { rowIndex = i; break; }
      if (rowIndex < 0) return _fail('Interação não encontrada.');
      var filCol = headers.indexOf('FIL');
      var psiCol = headers.indexOf('PSI');
      var iaCol = headers.indexOf('IA');
      if (filCol < 0 || psiCol < 0 || iaCol < 0) return _fail('Colunas FIL, PSI e IA não encontradas.');
      var filInput = data.fil !== undefined ? data.fil : data.FIL !== undefined ? data.FIL : values[rowIndex][filCol];
      var psiInput = data.psi !== undefined ? data.psi : data.PSI !== undefined ? data.PSI : values[rowIndex][psiCol];
      var iaInput = data.ia !== undefined ? data.ia : data.IA !== undefined ? data.IA : values[rowIndex][iaCol];
      var validation = typeof ValidationService !== 'undefined' && ValidationService.validatePotion ? ValidationService.validatePotion(filInput, psiInput, iaInput) : _ok({ fil: Number(filInput), psi: Number(psiInput), ia: Number(iaInput) });
      if (!validation.success) return validation;
      var fields = { FIL: validation.data.fil, PSI: validation.data.psi, IA: validation.data.ia, FreeText: data.freeText !== undefined ? _cleanText(data.freeText) : data.FreeText, IsActive: data.isActive !== undefined ? data.isActive : data.IsActive };
      Object.keys(fields).forEach(function (field) { var col = headers.indexOf(field); if (col >= 0 && fields[field] !== undefined) values[rowIndex][col] = fields[field]; });
      var updatedAt = headers.indexOf('UpdatedAt'); if (updatedAt >= 0) values[rowIndex][updatedAt] = Utils.getTimestamp();
      sheet.getRange(1, 1, values.length, headers.length).setValues(values); _log('UPDATE', id, data.actorId); return _ok({ interactionId: id });
    } catch (err) { return _fail(err); } finally { lock.releaseLock(); }
  }
  return { createInteraction: createInteraction, getAllInteractions: getAllInteractions, getInteractionsByUser: getInteractionsByUser, getInteractionById: getInteractionById, updateInteraction: updateInteraction, getInteractionsByScenario: getInteractionsByScenario, getLatestInteraction: getLatestInteraction };
})();
