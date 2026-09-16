/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — ScenarioDifficultyService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Gestão de 4 níveis de dificuldade dos cenários. Determina complexidade, peso psicométrico e critérios TRI.
 *
 * FUNCIONALIDADES:
 *   • getAllDifficulties() — Lista os 4 níveis.
   • getDifficultyByLevel(level) — Busca nível.
   • getDifficultyMultiplier(level) — Multiplicador de pontuação.
   • getNextDifficulty(currentLevel) — Próximo nível.
   • getScenariosByDifficulty(level) — Cenários de um nível.
   • calculateProgression(userId) — Nível atual do utilizador.
 *
 * INTEGRAÇÕES:
 *   • ScenarioController — cenários filtrados.
   • ScoreService — multiplicadores.
   • ProgressionService — avanço de nível.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — {{ success, data, error }}.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ScenarioDifficultyService = (function () {
  var LEVELS = [
    { level: 'easy', rank: 1, label: 'Fácil', multiplier: 1.0, description: 'Introdução guiada e baixa ambiguidade.' },
    { level: 'medium', rank: 2, label: 'Médio', multiplier: 1.5, description: 'Decisão com múltiplas perspectivas.' },
    { level: 'hard', rank: 3, label: 'Difícil', multiplier: 2.0, description: 'Conflitos complexos e informação incompleta.' },
    { level: 'expert', rank: 4, label: 'Especialista', multiplier: 2.5, description: 'Problema aberto, sistémico e interdisciplinar.' }
  ];
  function _ok(data) { return typeof ServiceResult !== 'undefined' ? ServiceResult.ok(data) : { success: true, data: data, error: null }; }
  function _fail(message, fallback) { return typeof ServiceResult !== 'undefined' ? ServiceResult.fail(message, fallback) : { success: false, data: fallback || null, error: message }; }
  function _level(level) { return String(level || 'medium').trim().toLowerCase(); }
  function getAllDifficulties() { return _ok(LEVELS.slice()); }
  function getDifficultyByLevel(level) {
    var item = LEVELS.filter(function (entry) { return entry.level === _level(level); })[0];
    return item ? _ok(item) : _fail('Nível de dificuldade inválido.');
  }
  function getDifficultyMultiplier(level) {
    var result = getDifficultyByLevel(level);
    return result.success ? _ok(result.data.multiplier) : result;
  }
  function getNextDifficulty(currentLevel) {
    var current = getDifficultyByLevel(currentLevel);
    if (!current.success) return current;
    var next = LEVELS.filter(function (entry) { return entry.rank === current.data.rank + 1; })[0];
    return _ok(next || current.data);
  }
  function getScenariosByDifficulty(level) {
    var valid = getDifficultyByLevel(level);
    if (!valid.success) return valid;
    if (typeof ScenarioController === 'undefined' || !ScenarioController.getAllScenarios) return _fail('ScenarioController não disponível.', []);
    var result = ScenarioController.getAllScenarios();
    if (!result.success) return result;
    return _ok(result.data.filter(function (scenario) {
      return _level(scenario.Difficulty) === valid.data.level;
    }));
  }
  function calculateProgression(userId) {
    if (!userId) return _fail('Utilizador é obrigatório.');
    try {
      if (typeof ProgressionService !== 'undefined' && ProgressionService.getProgressionPercent) {
        var delegated = ProgressionService.getProgressionPercent(userId);
        if (delegated.success) return _ok({ level: getAllDifficulties().data[Math.min(3, Math.floor(Number(delegated.data || 0) / 25))], percent: Number(delegated.data || 0) });
      }
      var scores = typeof ScoreController !== 'undefined' && ScoreController.getScoresByUser ? ScoreController.getScoresByUser(userId) : _ok([]);
      if (!scores.success) return scores;
      var average = scores.data.length ? scores.data.reduce(function (sum, row) { return sum + Number(row.Score || 0); }, 0) / scores.data.length : 0;
      var rank = average >= 85 ? 4 : average >= 70 ? 3 : average >= 50 ? 2 : 1;
      return _ok({ level: LEVELS[rank - 1], percent: Math.round(average) });
    } catch (err) { return _fail(err, null); }
  }
  return { getAllDifficulties: getAllDifficulties, getDifficultyByLevel: getDifficultyByLevel, getDifficultyMultiplier: getDifficultyMultiplier, getNextDifficulty: getNextDifficulty, getScenariosByDifficulty: getScenariosByDifficulty, calculateProgression: calculateProgression };
})();
