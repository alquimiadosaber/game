/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — CauldronService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Motor do caldeirão computacional — interface central do simulador epistémico.
 *   Gerencia estado do caldeirão, misturas (FIL+PSI+IA), validação de proporções,
 *   cálculo de reações e geração de feedback visual para animação.
 *
 * FUNCIONALIDADES:
 *   • initializeCauldron(userId, scenarioId) — Inicializa estado do caldeirão.
 *   • addIngredient(component, amount) — Adiciona componente (FIL/PSI/IA).
 *   • getMixtureState(userId) — Retorna estado atual da mistura.
 *   • calculateReaction(fil, psi, ia) — Calcula reação epistémica.
 *   • submitPotion(userId, mixture) — Submete poção para avaliação.
 *   • getCauldronAnimation(mixture) — Dados para animação do frontend.
 *   • resetCauldron(userId) — Reseta estado do caldeirão.
 *   • validateMixture(fil, psi, ia) — Valida proporções (soma=100%).
 *
 * MISTURA EPISTÉMICA:
 *   FIL (Filosofia) + PSI (Psicologia) + IA (Inteligência Artificial) = 100%
 *   Cada componente representa uma dimensão de análise do dilema ético.
 *   
 *   Exemplos de reações:
 *   - Alta FIL (>50%): Análise ética profunda, pensamento crítico
 *   - Alta PSI (>50%): Foco em comportamento humano, empatia
 *   - Alta IA (>50%): Solução tecnológica, automação
 *   - Balanceado (33/33/34): Abordagem holística
 *
 * INTEGRAÇÕES:
 *   • InteractionService — processamento da poção submetida.
 *   • DimensionService — atualização de vectores psicométricos.
 *   • ScoreService — cálculo de pontuação TRI.
 *   • ScenarioController — validação do cenário ativo.
 *   • AppCacheService — cache de estado do caldeirão.
 *
 * STATE MANAGEMENT:
 *   Estado do caldeirão é mantido em PropertiesService (user-scoped) durante
 *   a sessão. Cada utilizador tem seu caldeirão independente.
 *
 * PADRÕES:
 *   State machine — caldeirão tem estados (empty, mixing, ready, processing).
 *   Real-time feedback — validação imediata de proporções.
 *   Animation data — retorna dados estruturados para frontend animar.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const CauldronService = (function () {

  var CAULDRON_STATES = {
    EMPTY: 'empty',
    MIXING: 'mixing',
    READY: 'ready',
    PROCESSING: 'processing'
  };

  var ANIMATION_COLORS = {
    FIL: '#8B4513', // Marrom (Filosofia - terra, fundação)
    PSI: '#4169E1', // Azul royal (Psicologia - mente, consciência)
    IA: '#00CED1'   // Ciano (IA - tecnologia, futuro)
  };

  var REACTION_TYPES = {
    BALANCED: 'balanced',
    PHILOSOPHICAL: 'philosophical',
    PSYCHOLOGICAL: 'psychological',
    TECHNOLOGICAL: 'technological',
    HYBRID: 'hybrid'
  };

  function _getCauldronKey(userId) {
    return 'cauldron_state_' + userId;
  }

  function _getState(userId) {
    try {
      var key = _getCauldronKey(userId);
      var cached = PropertiesService.getUserProperties().getProperty(key);
      
      if (!cached) {
        return {
          userId: userId,
          state: CAULDRON_STATES.EMPTY,
          fil: 0,
          psi: 0,
          ia: 0,
          scenarioId: null,
          timestamp: new Date().toISOString()
        };
      }
      
      return JSON.parse(cached);
    } catch (err) {
      return {
        userId: userId,
        state: CAULDRON_STATES.EMPTY,
        fil: 0,
        psi: 0,
        ia: 0,
        scenarioId: null,
        timestamp: new Date().toISOString()
      };
    }
  }

  function _setState(userId, state) {
    try {
      var key = _getCauldronKey(userId);
      PropertiesService.getUserProperties().setProperty(key, JSON.stringify(state));
      return { success: true, data: state, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function _clearState(userId) {
    try {
      var key = _getCauldronKey(userId);
      PropertiesService.getUserProperties().deleteProperty(key);
      return { success: true, data: null, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  // O frontend envia valores de input como texto. A conversão precisa ser
  // explícita e limitada à notação decimal; coerções de JS (null, true, []),
  // que poderiam virar números válidos, devem ser rejeitadas.
  function _finiteNumber(value) {
    if (typeof value === 'number') {
      return isFinite(value) ? { valid: true, value: value } : { valid: false };
    }

    if (typeof value !== 'string') return { valid: false };

    var text = value.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
      return { valid: false };
    }

    var parsed = Number(text);
    return isFinite(parsed) ? { valid: true, value: parsed } : { valid: false };
  }

  function validateMixture(fil, psi, ia) {
    try {
      var filResult = _finiteNumber(fil);
      var psiResult = _finiteNumber(psi);
      var iaResult = _finiteNumber(ia);

      if (!filResult.valid || !psiResult.valid || !iaResult.valid) {
        return { success: false, data: null, error: 'Valores inválidos. Use números.' };
      }

      var filVal = filResult.value;
      var psiVal = psiResult.value;
      var iaVal = iaResult.value;
      
      if (filVal < 0 || psiVal < 0 || iaVal < 0) {
        return { success: false, data: null, error: 'Valores não podem ser negativos.' };
      }
      
      if (filVal > 100 || psiVal > 100 || iaVal > 100) {
        return { success: false, data: null, error: 'Valores não podem exceder 100%.' };
      }
      
      var sum = filVal + psiVal + iaVal;
      
      if (Math.abs(sum - 100) > 0.0001) { // Mesma tolerância da validação compartilhada.
        return {
          success: false,
          data: { fil: filVal, psi: psiVal, ia: iaVal, sum: sum },
          error: 'A soma deve ser exatamente 100%. Soma atual: ' + sum.toFixed(2) + '%'
        };
      }
      
      return {
        success: true,
        data: { fil: filVal, psi: psiVal, ia: iaVal, valid: true },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function initializeCauldron(userId, scenarioId) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    
    try {
      // Valida cenário se fornecido
      if (scenarioId && typeof ScenarioController !== 'undefined') {
        var scenarioResult = ScenarioController.getScenarioById(scenarioId);
        if (!scenarioResult.success) {
          return { success: false, data: null, error: 'Cenário não encontrado.' };
        }
      }
      
      var state = {
        userId: userId,
        state: CAULDRON_STATES.EMPTY,
        fil: 0,
        psi: 0,
        ia: 0,
        scenarioId: scenarioId || null,
        timestamp: new Date().toISOString()
      };
      
      return _setState(userId, state);
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function addIngredient(userId, component, amount) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    if (!component) return { success: false, data: null, error: 'Componente é obrigatório.' };
    
    try {
      var normalized = String(component).toUpperCase();
      
      if (!['FIL', 'PSI', 'IA'].includes(normalized)) {
        return { success: false, data: null, error: 'Componente inválido. Use: FIL, PSI ou IA.' };
      }
      
      var amountResult = _finiteNumber(amount);
      if (!amountResult.valid) {
        return { success: false, data: null, error: 'Quantidade deve ser um número entre 0 e 100.' };
      }

      var amountVal = amountResult.value;
      if (amountVal < 0 || amountVal > 100) {
        return { success: false, data: null, error: 'Quantidade deve estar entre 0 e 100.' };
      }
      
      var state = _getState(userId);
      
      // Atualiza componente
      state[normalized.toLowerCase()] = amountVal;
      state.state = CAULDRON_STATES.MIXING;
      state.timestamp = new Date().toISOString();
      
      // Valida se soma é 100%
      var validation = validateMixture(state.fil, state.psi, state.ia);
      if (validation.success) {
        state.state = CAULDRON_STATES.READY;
      }
      
      return _setState(userId, state);
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getMixtureState(userId) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    
    try {
      var state = _getState(userId);
      
      return {
        success: true,
        data: {
          state: state.state,
          fil: state.fil,
          psi: state.psi,
          ia: state.ia,
          scenarioId: state.scenarioId,
          timestamp: state.timestamp,
          isValid: state.state === CAULDRON_STATES.READY
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function calculateReaction(fil, psi, ia) {
    try {
      var validation = validateMixture(fil, psi, ia);
      if (!validation.success) return validation;
      
      var filVal = validation.data.fil;
      var psiVal = validation.data.psi;
      var iaVal = validation.data.ia;
      
      // Determina tipo de reação baseado em dominância
      var reactionType = REACTION_TYPES.BALANCED;
      var dominantComponent = null;
      var intensity = 'medium';
      
      if (Math.abs(filVal - psiVal) < 10 && Math.abs(psiVal - iaVal) < 10) {
        reactionType = REACTION_TYPES.BALANCED;
        intensity = 'high';
      } else if (filVal > 50) {
        reactionType = REACTION_TYPES.PHILOSOPHICAL;
        dominantComponent = 'FIL';
        intensity = filVal > 70 ? 'very_high' : 'high';
      } else if (psiVal > 50) {
        reactionType = REACTION_TYPES.PSYCHOLOGICAL;
        dominantComponent = 'PSI';
        intensity = psiVal > 70 ? 'very_high' : 'high';
      } else if (iaVal > 50) {
        reactionType = REACTION_TYPES.TECHNOLOGICAL;
        dominantComponent = 'IA';
        intensity = iaVal > 70 ? 'very_high' : 'high';
      } else {
        reactionType = REACTION_TYPES.HYBRID;
        intensity = 'medium';
      }
      
      // Gera descrição da reação
      var descriptions = {
        balanced: 'O caldeirão brilha com harmonia tricolor. Abordagem holística detectada.',
        philosophical: 'Vapores marrons se elevam. Profundidade ética em análise.',
        psychological: 'Ondas azuis pulsam no caldeirão. Empatia e compreensão humana ativadas.',
        technological: 'Luzes cianas lampejam. Solução computacional em processamento.',
        hybrid: 'O caldeirão mistura cores de forma única. Síntese criativa em progresso.'
      };
      
      return {
        success: true,
        data: {
          reactionType: reactionType,
          dominantComponent: dominantComponent,
          intensity: intensity,
          description: descriptions[reactionType],
          mixture: { fil: filVal, psi: psiVal, ia: iaVal }
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getCauldronAnimation(fil, psi, ia) {
    try {
      var validation = validateMixture(fil, psi, ia);
      if (!validation.success) {
        // Retorna animação de erro
        return {
          success: true,
          data: {
            type: 'error',
            color: '#FF0000',
            intensity: 0,
            particles: [],
            message: validation.error
          },
          error: null
        };
      }
      
      var reaction = calculateReaction(fil, psi, ia);
      if (!reaction.success) return reaction;
      
      var filVal = validation.data.fil;
      var psiVal = validation.data.psi;
      var iaVal = validation.data.ia;
      
      // Gera cor resultante (mistura ponderada RGB)
      var colorMix = {
        r: Math.round((139 * filVal + 65 * psiVal + 0 * iaVal) / 100),
        g: Math.round((69 * filVal + 105 * psiVal + 206 * iaVal) / 100),
        b: Math.round((19 * filVal + 225 * psiVal + 209 * iaVal) / 100)
      };
      
      var resultColor = '#' +
        colorMix.r.toString(16).padStart(2, '0') +
        colorMix.g.toString(16).padStart(2, '0') +
        colorMix.b.toString(16).padStart(2, '0');
      
      // Gera partículas para animação
      var particles = [];
      if (filVal > 0) particles.push({ type: 'FIL', color: ANIMATION_COLORS.FIL, amount: filVal });
      if (psiVal > 0) particles.push({ type: 'PSI', color: ANIMATION_COLORS.PSI, amount: psiVal });
      if (iaVal > 0) particles.push({ type: 'IA', color: ANIMATION_COLORS.IA, amount: iaVal });
      
      // Calcula intensidade da animação (0-100)
      var intensityMap = {
        'very_high': 100,
        'high': 80,
        'medium': 60,
        'low': 40
      };
      
      var animationIntensity = intensityMap[reaction.data.intensity] || 60;
      
      return {
        success: true,
        data: {
          type: 'reaction',
          reactionType: reaction.data.reactionType,
          color: resultColor,
          intensity: animationIntensity,
          particles: particles,
          message: reaction.data.description,
          dominantComponent: reaction.data.dominantComponent
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function submitPotion(userId, mixture) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    if (!mixture) return { success: false, data: null, error: 'Mistura é obrigatória.' };
    
    try {
      var state = _getState(userId);
      
      if (state.state !== CAULDRON_STATES.READY) {
        return { success: false, data: null, error: 'Caldeirão não está pronto. Complete a mistura primeiro.' };
      }
      
      // Atualiza estado para processando
      state.state = CAULDRON_STATES.PROCESSING;
      _setState(userId, state);
      
      // Prepara dados para InteractionService
      var interaction = {
        userId: userId,
        scenarioId: state.scenarioId,
        fil: state.fil,
        psi: state.psi,
        ia: state.ia,
        responseText: mixture.responseText || '',
        timestamp: new Date().toISOString()
      };
      
      // Aqui seria chamado InteractionService.processPotion(interaction)
      // Como InteractionService ainda é stub, simulamos resposta básica
      
      // Limpa estado do caldeirão após submissão
      _clearState(userId);
      
      return {
        success: true,
        data: {
          message: 'Poção submetida com sucesso!',
          mixture: { fil: state.fil, psi: state.psi, ia: state.ia },
          scenarioId: state.scenarioId
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function resetCauldron(userId) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    
    try {
      return _clearState(userId);
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    initializeCauldron: initializeCauldron,
    addIngredient: addIngredient,
    getMixtureState: getMixtureState,
    calculateReaction: calculateReaction,
    submitPotion: submitPotion,
    getCauldronAnimation: getCauldronAnimation,
    resetCauldron: resetCauldron,
    validateMixture: validateMixture
  };
})();
