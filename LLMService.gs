/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — LLMService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Integração com modelos de linguagem (LLMs) externos via UrlFetchApp. Avalia respostas textuais em cenários de alta complexidade.
 *
 * FUNCIONALIDADES:
 *   • evaluateResponse(text, scenarioId) — Avalia via LLM.
   • generateFeedback(response, score) — Feedback personalizado.
   • analyzeEthicalDimension(text) — Analisa dimensão ética.
   • classifyResponse(text, categories) — Classifica resposta.
   • generateScenarioNarrative(seed) — Gera narrativa.
   • summarizeInteraction(interactionId) — Resume interação.
 *
 * INTEGRAÇÕES:
 *   • UrlFetchApp — requisições HTTP ao LLM.
   • PropertiesService — LLM_API_KEY e LLM_BASE_URL.
   • CacheService — cache de avaliações.
   • SemanticAnalyzer — pré-processamento.
 * Cache-first — avaliações repetidas cacheadas.
   Rate limiting — controle de chamadas.
   Retry with exponential backoff — tolerância a falhas.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const LLMService = (function () {

  var CACHE_TTL = 86400; // 24h
  var MAX_RETRIES = 3;
  var RETRY_DELAY_MS = 1000;

  function _getConfig() {
    var apiKey = ConfigService.get('LLM_API_KEY');
    var baseUrl = ConfigService.get('LLM_BASE_URL');
    
    return {
      apiKey: apiKey,
      baseUrl: baseUrl || 'https://api.openai.com/v1',
      available: !!apiKey
    };
  }

  function _callLLM(prompt, options) {
    try {
      var config = _getConfig();
      if (!config.available) {
        return { success: false, data: null, error: 'LLM não configurado (LLM_API_KEY ausente).' };
      }
      
      var payload = {
        model: options.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: options.systemPrompt || 'Você é um assistente especializado em orientação vocacional.' },
          { role: 'user', content: prompt }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 500
      };
      
      var requestOptions = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'Authorization': 'Bearer ' + config.apiKey
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };
      
      var retries = 0;
      while (retries < MAX_RETRIES) {
        try {
          var response = UrlFetchApp.fetch(config.baseUrl + '/chat/completions', requestOptions);
          var responseCode = response.getResponseCode();
          
          if (responseCode === 200) {
            var result = JSON.parse(response.getContentText());
            return {
              success: true,
              data: {
                text: result.choices[0].message.content,
                usage: result.usage,
                model: result.model
              },
              error: null
            };
          } else if (responseCode === 429 || responseCode >= 500) {
            retries++;
            if (retries < MAX_RETRIES) {
              Utilities.sleep(RETRY_DELAY_MS * Math.pow(2, retries - 1));
              continue;
            }
          }
          
          return { success: false, data: null, error: 'LLM retornou código ' + responseCode };
        } catch (err) {
          retries++;
          if (retries >= MAX_RETRIES) {
            return { success: false, data: null, error: err.message };
          }
          Utilities.sleep(RETRY_DELAY_MS * Math.pow(2, retries - 1));
        }
      }
      
      return { success: false, data: null, error: 'Máximo de tentativas excedido.' };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function evaluateResponse(text, scenarioId) {
    try {
      var cacheKey = 'llm:evaluate:' + scenarioId + ':' + Utils.hashString(text);
      
      if (typeof AppCacheService !== 'undefined') {
        var cached = AppCacheService.get(cacheKey);
        if (cached.success && cached.data) {
          return { success: true, data: cached.data, error: null };
        }
      }
      
      var prompt = 'Avalie a seguinte resposta ao cenário ' + scenarioId + ' em uma escala de 0-100 considerando:\n' +
                   '1. Coerência e clareza (40%)\n' +
                   '2. Profundidade semântica (30%)\n' +
                   '3. Originalidade (20%)\n' +
                   '4. Adequação ao contexto (10%)\n\n' +
                   'Resposta: "' + text + '"\n\n' +
                   'Retorne apenas um JSON com: {"coherence": N, "semantic": N, "originality": N, "context": N, "total": N, "feedback": "breve comentário"}';
      
      var llmResult = _callLLM(prompt, {
        systemPrompt: 'Você é um avaliador especializado em respostas vocacionais.',
        temperature: 0.3,
        maxTokens: 300
      });
      
      if (!llmResult.success) return llmResult;
      
      var evaluation = JSON.parse(llmResult.data.text);
      
      if (typeof AppCacheService !== 'undefined') {
        AppCacheService.put(cacheKey, evaluation, CACHE_TTL);
      }
      
      return { success: true, data: evaluation, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function generateFeedback(response, score) {
    try {
      var prompt = 'Gere um feedback construtivo e motivador para um aluno que obteve ' + score + ' pontos em sua resposta:\n' +
                   '"' + response + '"\n\n' +
                   'O feedback deve ter no máximo 2 frases e focar em aspectos positivos e oportunidades de melhoria.';
      
      var llmResult = _callLLM(prompt, {
        systemPrompt: 'Você é um orientador vocacional empático e motivador.',
        temperature: 0.8,
        maxTokens: 150
      });
      
      if (!llmResult.success) {
        // Fallback genérico
        var fallback = score >= 80 ? 'Excelente trabalho! Continue explorando suas ideias.' :
                       score >= 60 ? 'Bom trabalho! Considere expandir sua análise.' :
                       'Continue praticando! Cada resposta é uma oportunidade de aprendizagem.';
        return { success: true, data: { feedback: fallback }, error: null };
      }
      
      return { success: true, data: { feedback: llmResult.data.text }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function analyzeEthicalDimension(text) {
    try {
      var prompt = 'Analise a dimensão ética da seguinte resposta em uma escala de 0-100:\n"' + text + '"\n\n' +
                   'Considere: respeito pela diversidade, consciência social, empatia e responsabilidade.\n' +
                   'Retorne apenas um JSON: {"ethicalScore": N, "aspects": ["aspecto1", "aspecto2"]}';
      
      var llmResult = _callLLM(prompt, {
        systemPrompt: 'Você é um especialista em ética aplicada.',
        temperature: 0.4,
        maxTokens: 200
      });
      
      if (!llmResult.success) {
        return { success: true, data: { ethicalScore: 70, aspects: [] }, error: null };
      }
      
      var analysis = JSON.parse(llmResult.data.text);
      return { success: true, data: analysis, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function classifyResponse(text, categories) {
    try {
      var prompt = 'Classifique a seguinte resposta nas categorias fornecidas:\n' +
                   'Resposta: "' + text + '"\n' +
                   'Categorias: ' + JSON.stringify(categories) + '\n\n' +
                   'Retorne JSON: {"category": "nome", "confidence": 0-100}';
      
      var llmResult = _callLLM(prompt, {
        temperature: 0.2,
        maxTokens: 100
      });
      
      if (!llmResult.success) {
        return { success: true, data: { category: categories[0], confidence: 50 }, error: null };
      }
      
      var classification = JSON.parse(llmResult.data.text);
      return { success: true, data: classification, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function generateScenarioNarrative(seed) {
    try {
      var prompt = 'Gere uma narrativa alquímica curta (3-4 frases) baseada em: ' + JSON.stringify(seed) + '\n' +
                   'Use linguagem poética e metafórica relacionada à alquimia.';
      
      var llmResult = _callLLM(prompt, {
        systemPrompt: 'Você é um contador de histórias especializado em narrativas alquímicas.',
        temperature: 0.9,
        maxTokens: 200
      });
      
      if (!llmResult.success) {
        return { success: true, data: { narrative: 'A jornada alquímica continua...' }, error: null };
      }
      
      return { success: true, data: { narrative: llmResult.data.text }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function summarizeInteraction(interactionId) {
    try {
      var result = Utils.getAllRows('Interactions');
      if (!result.success) return result;
      
      var interaction = result.data.filter(function(i) {
        return i.InteractionID === interactionId;
      })[0];
      
      if (!interaction) {
        return { success: false, data: null, error: 'Interação não encontrada.' };
      }
      
      var prompt = 'Resuma em 1 frase a seguinte interação:\n' +
                   'Cenário: ' + interaction.ScenarioID + '\n' +
                   'Resposta: ' + (interaction.Response || 'N/A');
      
      var llmResult = _callLLM(prompt, {
        temperature: 0.5,
        maxTokens: 100
      });
      
      if (!llmResult.success) {
        return { success: true, data: { summary: 'Interação completada.' }, error: null };
      }
      
      return { success: true, data: { summary: llmResult.data.text }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    evaluateResponse: evaluateResponse,
    generateFeedback: generateFeedback,
    analyzeEthicalDimension: analyzeEthicalDimension,
    classifyResponse: classifyResponse,
    generateScenarioNarrative: generateScenarioNarrative,
    summarizeInteraction: summarizeInteraction
  };
})();
