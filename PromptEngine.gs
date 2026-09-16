/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — PromptEngine.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Geração de prompts para avaliação de respostas por LLMs. Constrói prompts estruturados para avaliação ética, psicométrica e computacional.
 *
 * FUNCIONALIDADES:
 *   • buildEvaluationPrompt(text, scenario, dimensions) — Prompt de avaliação.
   • buildFeedbackPrompt(score, dimensions) — Prompt de feedback.
   • buildScenarioPrompt(category, difficulty) — Prompt de cenário.
   • buildCoherencePrompt(fil, psi, ia) — Prompt de coerência.
   • templateEvaluation — Template base de avaliação.
   • templateFeedback — Template base de feedback.
 *
 * INTEGRAÇÕES:
 *   • LLMService — envio dos prompts.
   • SemanticAnalyzer — pré-processamento.
   • ConfigService — configurações de prompt.
 * Template-based prompting — prompts reutilizáveis.
   Structured output — prompts exigem JSON.
   System prompt + user prompt — separação de contexto.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — {{ success, data, error }}.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const PromptEngine = (function () {
  var templateEvaluation = 'Avalie a resposta do estudante com base no cenário e nas dimensões. Retorne JSON válido com score, coherence, semantic, originality e rationale.';
  var templateFeedback = 'Gere feedback pedagógico curto, específico e encorajador. Retorne JSON válido com strengths, improvements e nextStep.';
  function _ok(data) { return typeof ServiceResult !== 'undefined' ? ServiceResult.ok(data) : { success: true, data: data, error: null }; }
  function _fail(message, fallback) { return typeof ServiceResult !== 'undefined' ? ServiceResult.fail(message, fallback) : { success: false, data: fallback || null, error: message }; }
  function _text(value, max) { return String(value === undefined || value === null ? '' : value).trim().substring(0, max || 4000); }
  function _json(value) { try { return JSON.stringify(value || {}); } catch (err) { return '{}'; } }
  function buildEvaluationPrompt(text, scenario, dimensions) {
    if (!_text(text, 6000)) return _fail('Resposta textual é obrigatória.');
    return _ok(templateEvaluation + '\n\nCENÁRIO:\n' + _text(scenario && (scenario.Description || scenario.description || scenario.Title), 3000) + '\n\nDIMENSÕES:\n' + _json(dimensions) + '\n\nRESPOSTA:\n' + _text(text, 6000));
  }
  function buildFeedbackPrompt(score, dimensions) {
    var safeScore = Math.max(0, Math.min(100, Number(score) || 0));
    return _ok(templateFeedback + '\n\nPONTUAÇÃO: ' + safeScore + '\nDIMENSÕES: ' + _json(dimensions));
  }
  function buildScenarioPrompt(category, difficulty) {
    var safeCategory = _text(category, 120) || 'interdisciplinaridade';
    var safeDifficulty = _text(difficulty, 40) || 'medium';
    return _ok('Crie um cenário educacional sobre ' + safeCategory + ' com dificuldade ' + safeDifficulty + '. Inclua contexto, dilema ético, dados e uma pergunta aberta. Retorne JSON com title, description, category e difficulty.');
  }
  function buildCoherencePrompt(fil, psi, ia) {
    var values = [Number(fil), Number(psi), Number(ia)];
    if (values.some(function (value) { return !isFinite(value) || value < 0; })) return _fail('Proporções inválidas.');
    return _ok('Avalie a coerência da mistura epistemológica FIL=' + values[0] + ', PSI=' + values[1] + ', IA=' + values[2] + '. Retorne JSON com coherenceScore e explanation.');
  }
  return { templateEvaluation: templateEvaluation, templateFeedback: templateFeedback, buildEvaluationPrompt: buildEvaluationPrompt, buildFeedbackPrompt: buildFeedbackPrompt, buildScenarioPrompt: buildScenarioPrompt, buildCoherencePrompt: buildCoherencePrompt };
})();
