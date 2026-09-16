/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — InteractionService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Processamento de poções — mecânica central do simulador. Recebe alocação nas 3 barras e processa a mistura epistémica.
 *
 * FUNCIONALIDADES:
 *   • processPotion(interaction) — Processa poção completa.
   • validatePotion(fil, psi, ia) — Valida soma 100%.
   • calculateDimensionDelta(fil, psi, ia) — Variação nos vectores.
   • applyDimensionUpdate(userId, delta) — Atualiza vectores.
   • generatePotionFeedback(fil, psi, ia) — Feedback da mistura.
   • analyzeResponseText(text, scenarioId) — Análise semântica.
 *
 * INTEGRAÇÕES:
 *   • DimensionService — atualização de vectores.
   • ScoreService — cálculo TRI.
   • SemanticAnalyzer — análise textual.
   • LLMService — avaliação por modelo.
   • CauldronService — animação/feedback visual.
 * Command pattern — processPotion() executa sequência de comandos.
   Event-driven — cada poção dispara cascata de atualizações.
   Proporção núcleo: FIL + PSI + IA = 100%.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — {{ success, data, error }}.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const InteractionService = (function () {
  var DIMENSIONS = ['IA', 'FIL', 'PSI', 'NEU', 'BIO', 'FIS', 'SOC', 'ART'];
  function _ok(data) { return typeof ServiceResult !== 'undefined' ? ServiceResult.ok(data) : { success: true, data: data, error: null }; }
  function _fail(message, fallback) { return typeof ServiceResult !== 'undefined' ? ServiceResult.fail(message, fallback) : { success: false, data: fallback || null, error: message }; }
  function validatePotion(fil, psi, ia) {
    if (typeof ValidationService !== 'undefined' && ValidationService.validatePotion) return ValidationService.validatePotion(fil, psi, ia);
    var values = [Number(fil), Number(psi), Number(ia)];
    return values.every(function (value) { return isFinite(value) && value >= 0; }) && Math.abs(values[0] + values[1] + values[2] - 100) < 0.0001
      ? _ok({ fil: values[0], psi: values[1], ia: values[2], total: 100 }) : _fail('A soma das proporções deve ser exatamente 100.');
  }
  function calculateDimensionDelta(fil, psi, ia) {
    var validation = validatePotion(fil, psi, ia);
    if (!validation.success) return validation;
    var values = validation.data;
    var delta = {}; DIMENSIONS.forEach(function (key) { delta[key] = 0; });
    delta.FIL = values.fil / 100; delta.PSI = values.psi / 100; delta.IA = values.ia / 100;
    delta.NEU = Math.round(((values.psi * 0.35 + values.ia * 0.15) / 100) * 1000) / 1000;
    delta.BIO = Math.round(((values.fil * 0.25 + values.psi * 0.1) / 100) * 1000) / 1000;
    delta.FIS = Math.round(((values.ia * 0.2) / 100) * 1000) / 1000;
    delta.SOC = Math.round(((values.fil * 0.2 + values.psi * 0.15) / 100) * 1000) / 1000;
    delta.ART = Math.round(((values.fil * 0.15 + values.ia * 0.15) / 100) * 1000) / 1000;
    return _ok(delta);
  }
  function applyDimensionUpdate(userId, delta) {
    if (!userId) return _fail('Utilizador é obrigatório.');
    if (typeof DimensionService === 'undefined' || !DimensionService.updateUserDimensions) return _fail('DimensionService não disponível.');
    return DimensionService.updateUserDimensions(userId, delta);
  }
  function generatePotionFeedback(fil, psi, ia) {
    var validation = validatePotion(fil, psi, ia); if (!validation.success) return validation;
    var values = validation.data; var entries = [{ key: 'FIL', value: values.fil }, { key: 'PSI', value: values.psi }, { key: 'IA', value: values.ia }];
    entries.sort(function (a, b) { return b.value - a.value; });
    var lead = entries[0];
    var messages = { FIL: 'A mistura privilegia reflexão filosófica e critérios éticos.', PSI: 'A mistura privilegia análise humana, empatia e comportamento.', IA: 'A mistura privilegia raciocínio computacional e experimentação.' };
    return _ok({ dominant: lead.key, proportions: values, message: messages[lead.key], balanced: Math.abs(values.fil - 25) <= 10 && Math.abs(values.psi - 25) <= 10 && Math.abs(values.ia - 50) <= 10 });
  }
  function analyzeResponseText(text, scenarioId) {
    var clean = String(text || '').trim(); if (!clean) return _fail('Resposta textual é obrigatória.');
    if (typeof SemanticAnalyzer !== 'undefined' && SemanticAnalyzer.analyze) return SemanticAnalyzer.analyze(clean, scenarioId);
    return _ok({ score: Math.min(100, 30 + Math.min(60, clean.split(/\s+/).length * 2)), coherenceScore: 70, semanticScore: 60, originalityScore: 60, fallback: true });
  }
  function processPotion(interaction) {
    interaction = interaction || {};
    var validation = validatePotion(interaction.fil !== undefined ? interaction.fil : interaction.FIL, interaction.psi !== undefined ? interaction.psi : interaction.PSI, interaction.ia !== undefined ? interaction.ia : interaction.IA);
    if (!validation.success) return validation;
    var delta = calculateDimensionDelta(validation.data.fil, validation.data.psi, validation.data.ia);
    var dimensionResult = interaction.userId || interaction.UserID ? applyDimensionUpdate(interaction.userId || interaction.UserID, delta.data) : _ok(null);
    if (!dimensionResult.success) return dimensionResult;
    var analysis = interaction.freeText || interaction.FreeText ? analyzeResponseText(interaction.freeText || interaction.FreeText, interaction.scenarioId || interaction.ScenarioID) : _ok(null);
    var feedback = generatePotionFeedback(validation.data.fil, validation.data.psi, validation.data.ia);
    var score = null;
    if (analysis.data && typeof ScoreService !== 'undefined' && ScoreService.calculateScore) {
      var scoreResult = ScoreService.calculateScore({ scenarioId: interaction.scenarioId || interaction.ScenarioID, difficulty: interaction.difficulty || 'medium', coherenceScore: analysis.data.coherenceScore, semanticScore: analysis.data.semanticScore, originalityScore: analysis.data.originalityScore });
      score = scoreResult.success ? scoreResult.data : null;
    }
    return _ok({ validation: validation.data, delta: delta.data, dimensions: dimensionResult.data, analysis: analysis.data, feedback: feedback.data, score: score });
  }
  return { processPotion: processPotion, validatePotion: validatePotion, calculateDimensionDelta: calculateDimensionDelta, applyDimensionUpdate: applyDimensionUpdate, generatePotionFeedback: generatePotionFeedback, analyzeResponseText: analyzeResponseText };
})();
