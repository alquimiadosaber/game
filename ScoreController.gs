/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — ScoreController.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Controlador CRUD para Pontuações. Gerencia pontuações calculadas pela TRI adaptada ao simulador vocacional.
 *
 * FUNCIONALIDADES:
 *   • createScore(data) — Cria pontuação (create).
   • getAllScores() — Lista todas (read).
   • getScoreById(id) — Busca por ID (read).
   • getScoresByUser(userId) — Pontuações do utilizador (read).
   • getScoresByScenario(scenarioId) — Pontuações de cenário (read).
   • updateScore(id, data) — Atualiza (update).
   • deleteScore(id) — Remove (delete).
   • getUserTotalScore(userId) — Pontuação total.
   • getUserAverageScore(userId) — Média.
 *
 * INTEGRAÇÕES:
 *   • SpreadsheetApp — aba Scores.
   • ScoreService — cálculo TRI.
   • ScoreRankingService — rankings.
   • InteractionService — pontuação gerada.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — {{ success, data, error }}.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ScoreController = (function () {
  function _ok(data) { return typeof ServiceResult !== 'undefined' ? ServiceResult.ok(data) : { success: true, data: data, error: null }; }
  function _fail(message, fallback) { return typeof ServiceResult !== 'undefined' ? ServiceResult.fail(message, fallback) : { success: false, data: fallback || null, error: message }; }
  function _rows() { return Utils.getAllRows('Scores'); }
  function _find(id, rows) { return (rows || []).filter(function (row) { return String(row.ScoreID || row.ID) === String(id); })[0] || null; }
  function _log(action, id, actor) { try { if (typeof LoggerService !== 'undefined' && LoggerService.logCRUD) LoggerService.logCRUD('Scores', action, id, actor || 'system'); } catch (err) {} }
  function createScore(data) {
    data = data || {};
    var userId = String(data.userId || data.UserID || '').trim();
    var score = Number(data.score !== undefined ? data.score : data.Score);
    var interactionId = String(data.interactionId || data.InteractionID || '').trim();
    
    if (!userId || !isFinite(score)) return _fail('UserID e Score são obrigatórios.');
    if (score < 0 || score > 100) return _fail('Score deve estar entre 0 e 100.');
    
    var id = typeof Utils.generateId === 'function' ? Utils.generateId() : String(new Date().getTime());
    var finalScore = Number(data.finalScore !== undefined ? data.finalScore : (data.FinalScore !== undefined ? data.FinalScore : score));
    var now = Utils.getTimestamp();
    var row = { 
      ScoreID: id, 
      UserID: userId, 
      ScenarioID: data.scenarioId || data.ScenarioID || '', 
      InteractionID: interactionId,
      Score: score, 
      FinalScore: isFinite(finalScore) ? finalScore : score, 
      XP: Number(data.xp || data.XP || 0), 
      Difficulty: data.difficulty || data.Difficulty || 'medium', 
      CreatedAt: now, 
      UpdatedAt: now, 
      IsActive: true, 
      Status: 'active' 
    };
    var result = Utils.addRow('Scores', row);
    if (!result.success) return result;
    _log('CREATE', id, data.actorId);
    return _ok({ scoreId: id });
  }
  function getAllScores() {
    var result = _rows();
    if (!result.success) return _fail(result.error, []);
    return _ok(result.data.filter(function (row) { return row.IsActive !== false && String(row.Status || '').toLowerCase() !== 'deleted'; }));
  }
  function getScoreById(id) {
    var result = getAllScores();
    if (!result.success) return result;
    var row = _find(id, result.data);
    return row ? _ok(row) : _fail('Pontuação não encontrada.');
  }
  function getScoresByUser(userId) {
    var result = getAllScores();
    if (!result.success) return result;
    return _ok(result.data.filter(function (row) { return String(row.UserID) === String(userId); }));
  }
  function getScoresByScenario(scenarioId) {
    var result = getAllScores();
    if (!result.success) return result;
    return _ok(result.data.filter(function (row) { return String(row.ScenarioID) === String(scenarioId); }));
  }
  function updateScore(id, data) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('Scores');
      if (!sheet) return _fail('Aba Scores não encontrada.');
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var idCol = headers.indexOf('ScoreID');
      if (idCol < 0) return _fail('Coluna ScoreID não encontrada.');
      var rowIndex = -1;
      for (var i = 1; i < values.length; i++) if (String(values[i][idCol]) === String(id)) { rowIndex = i; break; }
      if (rowIndex < 0) return _fail('Pontuação não encontrada.');
      var fields = { Score: data.score !== undefined ? Number(data.score) : data.Score, FinalScore: data.finalScore !== undefined ? Number(data.finalScore) : data.FinalScore, XP: data.xp !== undefined ? Number(data.xp) : data.XP, Difficulty: data.difficulty || data.Difficulty, IsActive: data.isActive !== undefined ? data.isActive : data.IsActive, Status: data.status !== undefined ? data.status : data.Status };
      Object.keys(fields).forEach(function (field) { var col = headers.indexOf(field); if (col >= 0 && fields[field] !== undefined && fields[field] !== '') values[rowIndex][col] = fields[field]; });
      var updatedAt = headers.indexOf('UpdatedAt'); if (updatedAt >= 0) values[rowIndex][updatedAt] = Utils.getTimestamp();
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      _log('UPDATE', id, data.actorId);
      return _ok({ scoreId: id });
    } catch (err) { return _fail(err); } finally { lock.releaseLock(); }
  }
  function deleteScore(id) { return updateScore(id, { IsActive: false, actorId: 'system' }); }
  function getUserTotalScore(userId) { var result = getScoresByUser(userId); if (!result.success) return result; return _ok(result.data.reduce(function (total, row) { return total + (Number(row.Score) || 0); }, 0)); }
  function getUserAverageScore(userId) { var result = getScoresByUser(userId); if (!result.success) return result; return _ok(result.data.length ? result.data.reduce(function (total, row) { return total + (Number(row.Score) || 0); }, 0) / result.data.length : 0); }
  return { createScore: createScore, getAllScores: getAllScores, getScoreById: getScoreById, getScoresByUser: getScoresByUser, getScoresByScenario: getScoresByScenario, updateScore: updateScore, deleteScore: deleteScore, getUserTotalScore: getUserTotalScore, getUserAverageScore: getUserAverageScore };
})();
