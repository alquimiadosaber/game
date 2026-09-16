/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — ScoreService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Cálculo de pontuação TRI adaptada. Avalia qualidade da resposta considerando dificuldade, coerência epistémica e análise semântica.
 *
 * FUNCIONALIDADES:
 *   • calculateScore(interaction) — Calcula pontuação TRI.
   • calculateTRIAbility(score, difficulty) — Habilidade theta.
   • getItemDifficulty(scenarioId) — Dificuldade do item.
   • calculateXP(score, difficulty) — XP gerado.
   • getScoreBreakdown(interaction) — Detalhamento.
   • applyDifficultyMultiplier(score, level) — Multiplicador.
 *
 * INTEGRAÇÕES:
 *   • ScoreController — criação na planilha.
   • ScenarioDifficultyService — multiplicadores.
   • SemanticAnalyzer — score semântico.
   • LLMService — avaliação por modelo.
 * TRI formula: P(correct)=1/(1+e^(-1.7*ability*(difficulty-ability))).
   Weighted: 40% coerência, 30% semântica, 20% originalidade, 10% dificuldade.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ScoreService = (function () {

  var WEIGHTS = {
    coherence: 0.40,
    semantic: 0.30,
    originality: 0.20,
    difficulty: 0.10
  };

  var DIFFICULTY_LEVELS = {
    'easy': 0.5,
    'medium': 1.0,
    'hard': 1.5,
    'expert': 2.0
  };

  var XP_BASE = 50;
  var XP_DIFFICULTY_MULTIPLIERS = {
    'easy': 1.0,
    'medium': 1.5,
    'hard': 2.0,
    'expert': 2.5
  };

  function _resultOk(data) {
    return typeof ServiceResult !== 'undefined' ? ServiceResult.ok(data) : {
      success: true, data: data === undefined ? null : data, error: null
    };
  }

  function _resultFail(message, fallback) {
    return typeof ServiceResult !== 'undefined' ? ServiceResult.fail(message, fallback) : {
      success: false, data: fallback === undefined ? null : fallback,
      error: String(message || 'Erro interno.')
    };
  }

  function _boundedScore(value, fallback) {
    var number = Number(value);
    if (!isFinite(number)) return fallback;
    return Math.max(0, Math.min(100, number));
  }

  function _normalizeInteraction(interaction) {
    if (!interaction || typeof interaction !== 'object') {
      return _resultFail('Interação inválida.', null);
    }
    return _resultOk({
      coherence: _boundedScore(interaction.coherenceScore, 70),
      semantic: _boundedScore(interaction.semanticScore, 70),
      originality: _boundedScore(interaction.originalityScore, 70),
      scenarioId: interaction.scenarioId || null,
      difficulty: String(interaction.difficulty || 'medium').toLowerCase()
    });
  }

  function getItemDifficulty(scenarioId) {
    try {
      if (typeof ScenarioController === 'undefined') {
        return { success: false, data: 1.0, error: 'ScenarioController não disponível.' };
      }
      
      var scenarioResult = ScenarioController.getScenarioById(scenarioId);
      if (!scenarioResult.success) {
        return { success: true, data: 1.0, error: null };
      }
      
      var difficultyLevel = String(scenarioResult.data.Difficulty || 'medium').toLowerCase();
      var difficulty = DIFFICULTY_LEVELS[difficultyLevel] || 1.0;
      
      return { success: true, data: difficulty, error: null };
    } catch (err) {
      return { success: false, data: 1.0, error: err.message };
    }
  }

  function calculateTRIAbility(score, difficulty) {
    try {
      // TRI formula simplificada: theta (habilidade) baseado no score e dificuldade
      // P(correct) = score/100
      // 1/(1+e^(-1.7*theta*(difficulty-theta))) = score/100
      
      var safeScore = _boundedScore(score, 0);
      var safeDifficulty = Number(difficulty);
      if (!isFinite(safeDifficulty) || safeDifficulty <= 0) safeDifficulty = 1.0;
      var probability = safeScore / 100;
      if (probability <= 0) probability = 0.01;
      if (probability >= 1) probability = 0.99;
      
      // Inversão aproximada da função logística
      var logit = Math.log(probability / (1 - probability));
      var theta = logit / (1.7 * safeDifficulty);
      
      return _resultOk(theta);
    } catch (err) {
      return _resultFail(err, 0);
    }
  }

  function applyDifficultyMultiplier(score, level) {
    try {
      var normalized = String(level || 'medium').toLowerCase();
      var multiplier = DIFFICULTY_LEVELS[normalized] || 1.0;
      
      // Aplica multiplicador (cenários mais difíceis valem mais)
      var adjustedScore = Math.min(100, _boundedScore(score, 0) * multiplier);
      
      return _resultOk(adjustedScore);
    } catch (err) {
      return _resultFail(err, score);
    }
  }

  function calculateXP(score, difficulty) {
    try {
      var normalized = String(difficulty || 'medium').toLowerCase();
      var multiplier = XP_DIFFICULTY_MULTIPLIERS[normalized] || 1.0;
      
      // XP = base * (score/100) * multiplier
      var xp = Math.round(XP_BASE * (_boundedScore(score, 0) / 100) * multiplier);
      
      return _resultOk(xp);
    } catch (err) {
      return _resultFail(err, 0);
    }
  }

  function getScoreBreakdown(interaction) {
    try {
      var normalizedResult = _normalizeInteraction(interaction);
      if (!normalizedResult.success) return normalizedResult;
      var normalized = normalizedResult.data;
      var coherence = normalized.coherence;
      var semantic = normalized.semantic;
      var originality = normalized.originality;
      var difficultyBonus = _boundedScore(interaction.difficultyBonus, 70);
      
      var breakdown = {
        coherence: {
          score: coherence,
          weight: WEIGHTS.coherence,
          contribution: coherence * WEIGHTS.coherence
        },
        semantic: {
          score: semantic,
          weight: WEIGHTS.semantic,
          contribution: semantic * WEIGHTS.semantic
        },
        originality: {
          score: originality,
          weight: WEIGHTS.originality,
          contribution: originality * WEIGHTS.originality
        },
        difficulty: {
          score: difficultyBonus,
          weight: WEIGHTS.difficulty,
          contribution: difficultyBonus * WEIGHTS.difficulty
        }
      };
      
      var totalScore = breakdown.coherence.contribution +
                       breakdown.semantic.contribution +
                       breakdown.originality.contribution +
                       breakdown.difficulty.contribution;
      
      return _resultOk({
          
          breakdown: breakdown,
          totalScore: Math.round(totalScore),
          weights: WEIGHTS
        });
    } catch (err) {
      return _resultFail(err, null);
    }
  }

  function calculateScore(interaction) {
    try {
      var normalizedResult = _normalizeInteraction(interaction);
      if (!normalizedResult.success) return normalizedResult;
      var normalized = normalizedResult.data;
      var coherence = normalized.coherence;
      var semantic = normalized.semantic;
      var originality = normalized.originality;
      
      // Obter dificuldade do cenário
      var difficultyResult = getItemDifficulty(normalized.scenarioId);
      var difficulty = difficultyResult.success ? difficultyResult.data : 1.0;
      
      // Calcula score ponderado base
      var baseScore = (coherence * WEIGHTS.coherence) +
                      (semantic * WEIGHTS.semantic) +
                      (originality * WEIGHTS.originality);
      
      // Aplica multiplicador de dificuldade
      var difficultyBonus = difficulty * 100 * WEIGHTS.difficulty;
      var finalScore = Math.min(100, Math.round(baseScore + difficultyBonus));
      
      // Calcula XP
      var xpResult = calculateXP(finalScore, normalized.difficulty);
      var xp = xpResult.success ? xpResult.data : 0;
      
      // Calcula habilidade TRI
      var abilityResult = calculateTRIAbility(finalScore, difficulty);
      var theta = abilityResult.success ? abilityResult.data : 0;
      
      return _resultOk({
          finalScore: finalScore,
          baseScore: Math.round(baseScore),
          difficultyBonus: Math.round(difficultyBonus),
          xp: xp,
          theta: theta,
          difficulty: difficulty,
          breakdown: {
            coherence: coherence,
            semantic: semantic,
            originality: originality
          }
        });
    } catch (err) {
      return _resultFail(err, null);
    }
  }

  return {
    calculateScore: calculateScore,
    calculateTRIAbility: calculateTRIAbility,
    getItemDifficulty: getItemDifficulty,
    calculateXP: calculateXP,
    getScoreBreakdown: getScoreBreakdown,
    applyDifficultyMultiplier: applyDifficultyMultiplier
  };
})();
