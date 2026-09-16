/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — NarrativeEngine.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Motor de narrativa adaptativa. Gera narrativa que se adapta ao perfil emergente do utilizador, criando experiência personalizada.
 *
 * FUNCIONALIDADES:
 *   • generateOpeningNarrative(userId) — Narrativa de abertura.
   • generateScenarioNarrative(scenarioId, userId) — Narrativa do cenário.
   • generateTransition(from, to) — Narrativa de transição.
   • generateEnding(userId) — Narrativa de conclusão (Ouro Alquímico).
   • getNarrativeProgress(userId) — Progresso narrativo.
   • adaptNarrativeToProfile(userId, narrative) — Adapta ao perfil.
 *
 * INTEGRAÇÕES:
 *   • VocationController — vocação para personalizar.
   • DimensionService — vectores para adaptar tom.
   • ScenarioController — cenário atual.
   • LLMService — geração de texto narrativo.
 * Adaptive narrative — conteúdo muda conforme perfil.
   Branching story — múltiplos caminhos narrativos.
   Personalized ending — conclusão baseada no perfil final.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const NarrativeEngine = (function () {

  var OPENING_TEMPLATES = [
    'Bem-vindo ao Laboratório Alquímico, jovem aprendiz. Aqui, cada poção que você criar revelará um fragmento de sua essência vocacional.',
    'Este laboratório guarda muitas perguntas. Prepare-se para combinar áreas do conhecimento e explicar suas escolhas.',
    'No caldeirão da sabedoria, ingredientes se transformam em descobertas. Sua jornada alquímica começa agora.'
  ];

  var TRANSITION_TEMPLATES = {
    progress: 'O caldeirão borbulha com {color} intensidade. Sua jornada avança, revelando novos caminhos...',
    discovery: 'Uma nova essência se manifesta! O aroma de {domain} permeia o ar...',
    challenge: 'As chamas do caldeirão oscilam. Um novo desafio se apresenta...'
  };

  var ENDING_TEMPLATES = {
    complete: 'Seu mapa de escolhas está pronto! {vocation} é uma área para explorar agora, não uma previsão sobre quem você é ou será.',
    partial: 'O elixir ainda não alcançou sua forma final, mas já revela traços marcantes de {domain}. Continue sua jornada...',
    diverse: 'Seu caldeirão contém múltiplas essências! Você possui afinidade com diversos domínios: {domains}.'
  };

  function generateOpeningNarrative(userId) {
    try {
      var template = OPENING_TEMPLATES[Math.floor(Math.random() * OPENING_TEMPLATES.length)];
      
      // Pode personalizar com nome do utilizador se disponível
      if (typeof UserController !== 'undefined') {
        var userResult = UserController.getUserById(userId);
        if (userResult.success && userResult.data.FullName) {
          var firstName = userResult.data.FullName.split(' ')[0];
          template = template.replace('jovem aprendiz', firstName);
        }
      }
      
      return { success: true, data: { narrative: template }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function generateScenarioNarrative(scenarioId, userId) {
    try {
      if (typeof ScenarioController === 'undefined') {
        return { success: false, data: null, error: 'ScenarioController não disponível.' };
      }
      
      var scenarioResult = ScenarioController.getScenarioById(scenarioId);
      if (!scenarioResult.success) return scenarioResult;
      
      var scenario = scenarioResult.data;
      
      // Narrativa base
      var narrative = 'O caldeirão aguarda seus ingredientes. ' + scenario.Title;
      
      // Adapta ao perfil do utilizador
      if (userId && typeof DimensionService !== 'undefined') {
        var dimsResult = DimensionService.getDimensionPercentages(userId);
        if (dimsResult.success && dimsResult.data) {
          var topDim = null;
          var topVal = 0;
          
          Object.keys(dimsResult.data).forEach(function(key) {
            if (dimsResult.data[key] > topVal) {
              topVal = dimsResult.data[key];
              topDim = key;
            }
          });
          
          if (topDim && topVal > 0.2) {
            var hints = {
              'IA': 'Os algoritmos sussurram possibilidades...',
              'FIL': 'A sabedoria ancestral ecoa nas paredes...',
              'PSI': 'As emoções humanas dançam no vapor...',
              'NEU': 'Os neurônios se conectam em padrões fascinantes...',
              'BIO': 'A vida pulsa em cada ingrediente...',
              'FIS': 'As leis da natureza se revelam...',
              'SOC': 'As vozes da comunidade ressoam...',
              'ART': 'A beleza se manifesta em formas inesperadas...'
            };
            
            narrative += ' ' + (hints[topDim] || '');
          }
        }
      }
      
      return { success: true, data: { narrative: narrative }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function generateTransition(from, to) {
    try {
      var type = to.difficulty > from.difficulty ? 'challenge' : 'progress';
      var template = TRANSITION_TEMPLATES[type] || TRANSITION_TEMPLATES.progress;
      
      var colors = {
        'easy': 'verde',
        'medium': 'dourada',
        'hard': 'violeta',
        'expert': 'prateada'
      };
      
      var color = colors[to.difficulty] || 'luminosa';
      var narrative = template.replace('{color}', color).replace('{domain}', to.category || 'conhecimento');
      
      return { success: true, data: { narrative: narrative }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function generateEnding(userId) {
    try {
      if (typeof ResultController === 'undefined' || typeof VocationController === 'undefined') {
        return { success: false, data: null, error: 'Controllers não disponíveis.' };
      }
      
      var latestResult = ResultController.getLatestResult(userId);
      if (!latestResult.success || !latestResult.data) {
        var template = ENDING_TEMPLATES.partial.replace('{domain}', 'exploração vocacional');
        return { success: true, data: { narrative: template }, error: null };
      }
      
      var vocationResult = VocationController.getVocationById(latestResult.data.VocationID);
      if (!vocationResult.success) {
        return { success: true, data: { narrative: ENDING_TEMPLATES.partial.replace('{domain}', 'múltiplas áreas') }, error: null };
      }
      
      var vocation = vocationResult.data;
      var template = ENDING_TEMPLATES.complete;
      var narrative = template.replace('{vocation}', vocation.Title);
      
      // Enriquece com LLM se disponível
      if (typeof LLMService !== 'undefined') {
        var llmResult = LLMService.generateScenarioNarrative({
          vocation: vocation.Title,
          domain: vocation.Domain,
          userId: userId,
          type: 'ending'
        });
        
        if (llmResult.success && llmResult.data.narrative) {
          narrative += '\n\n' + llmResult.data.narrative;
        }
      }
      
      return { success: true, data: { narrative: narrative, vocation: vocation }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getNarrativeProgress(userId) {
    try {
      if (typeof ProgressionService === 'undefined') {
        return { success: false, data: null, error: 'ProgressionService não disponível.' };
      }
      
      var percentResult = ProgressionService.getProgressionPercent(userId);
      if (!percentResult.success) return percentResult;
      
      var percent = percentResult.data;
      var phase = percent < 25 ? 'Iniciante' :
                  percent < 50 ? 'Aprendiz' :
                  percent < 75 ? 'Praticante' :
                  percent < 100 ? 'Mestre' : 'Alquimista';
      
      var description = percent < 25 ? 'Os primeiros vapores se elevam do caldeirão...' :
                        percent < 50 ? 'A poção começa a tomar forma...' :
                        percent < 75 ? 'O elixir se refina, revelando sua essência...' :
                        percent < 100 ? 'Seu mapa de escolhas está ganhando novas cores...' :
                        'A transmutação está completa!';
      
      return {
        success: true,
        data: {
          phase: phase,
          percent: percent,
          description: description
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function adaptNarrativeToProfile(userId, narrative) {
    try {
      if (!userId || !narrative) {
        return { success: true, data: { narrative: narrative }, error: null };
      }
      
      // Busca dimensão dominante
      if (typeof DimensionService === 'undefined') {
        return { success: true, data: { narrative: narrative }, error: null };
      }
      
      var dimsResult = DimensionService.getDimensionPercentages(userId);
      if (!dimsResult.success) {
        return { success: true, data: { narrative: narrative }, error: null };
      }
      
      var dims = dimsResult.data;
      var topDim = null;
      var topVal = 0;
      
      Object.keys(dims).forEach(function(key) {
        if (dims[key] > topVal) {
          topVal = dims[key];
          topDim = key;
        }
      });
      
      // Adiciona toque personalizado
      if (topDim && topVal > 0.3) {
        var touches = {
          'IA': ' Os padrões lógicos se iluminam em sua mente.',
          'FIL': ' As questões profundas ecoam em sua consciência.',
          'PSI': ' As emoções e motivações humanas se revelam.',
          'NEU': ' As conexões neurais formam mapas fascinantes.',
          'BIO': ' A complexidade da vida pulsa ao seu redor.',
          'FIS': ' As forças naturais dançam em harmonia.',
          'SOC': ' As interações sociais ganham novo significado.',
          'ART': ' A beleza estética transforma sua percepção.'
        };
        
        narrative += (touches[topDim] || '');
      }
      
      return { success: true, data: { narrative: narrative }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    generateOpeningNarrative: generateOpeningNarrative,
    generateScenarioNarrative: generateScenarioNarrative,
    generateTransition: generateTransition,
    generateEnding: generateEnding,
    getNarrativeProgress: getNarrativeProgress,
    adaptNarrativeToProfile: adaptNarrativeToProfile
  };
})();
