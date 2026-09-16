/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — SemanticAnalyzer.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Análise semântica de respostas textuais. Avalia coerência, originalidade e profundidade para alimentar o cálculo TRI.
 *
 * FUNCIONALIDADES:
 *   • analyze(text, scenarioId) — Análise semântica completa.
   • calculateCoherence(text, expectedKeywords) — Coerência.
   • calculateOriginality(text, existingResponses) — Originalidade.
   • calculateDepth(text) — Profundidade.
   • extractKeywords(text) — Extração de palavras-chave.
   • compareWithReference(text, reference) — Comparação com referência.
 *
 * INTEGRAÇÕES:
 *   • LLMService — análise avançada.
   • ScoreService — scores para TRI.
   • CacheService — cache de análises.
 * Multi-signal analysis — combinação de sinais textuais.
   Keyword matching — verificação de termos esperados.
   LLM fallback — quando análise local é insuficiente.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const SemanticAnalyzer = (function () {

  var STOPWORDS = ['o', 'a', 'de', 'do', 'da', 'em', 'um', 'uma', 'os', 'as', 'dos', 'das', 'para', 'com', 'por', 'no', 'na', 'nos', 'nas'];

  function _normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[^\wÀ-ÿ\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function _tokenize(text) {
    return _normalize(text).split(/\s+/).filter(function(word) {
      return word.length > 2 && STOPWORDS.indexOf(word) === -1;
    });
  }

  function extractKeywords(text) {
    try {
      var tokens = _tokenize(text);
      var freq = {};
      
      tokens.forEach(function(token) {
        freq[token] = (freq[token] || 0) + 1;
      });
      
      var keywords = Object.keys(freq).map(function(word) {
        return { word: word, frequency: freq[word] };
      }).sort(function(a, b) {
        return b.frequency - a.frequency;
      }).slice(0, 10);
      
      return { success: true, data: keywords, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function calculateCoherence(text, expectedKeywords) {
    try {
      var tokens = _tokenize(text);
      var expected = (expectedKeywords || []).map(function(k) {
        return _normalize(k);
      });
      
      if (expected.length === 0) {
        // Se não há palavras esperadas, avalia pela estrutura
        var sentences = text.split(/[.!?]+/).filter(function(s) { return s.trim().length > 0; });
        var avgWordPerSentence = tokens.length / Math.max(sentences.length, 1);
        
        // Coerência baseada em comprimento e estrutura
        var lengthScore = Math.min(100, (tokens.length / 50) * 100);
        var structureScore = Math.min(100, (avgWordPerSentence / 15) * 100);
        
        return { success: true, data: Math.round((lengthScore + structureScore) / 2), error: null };
      }
      
      var matches = 0;
      expected.forEach(function(keyword) {
        if (tokens.indexOf(keyword) !== -1) {
          matches++;
        }
      });
      
      var coherenceScore = Math.round((matches / expected.length) * 100);
      
      return { success: true, data: coherenceScore, error: null };
    } catch (err) {
      return { success: false, data: 0, error: err.message };
    }
  }

  function calculateOriginality(text, existingResponses) {
    try {
      var normalized = _normalize(text);
      var tokens = _tokenize(text);
      
      if (!existingResponses || existingResponses.length === 0) {
        return { success: true, data: 80, error: null };
      }
      
      var maxSimilarity = 0;
      
      existingResponses.forEach(function(existing) {
        var existingTokens = _tokenize(existing);
        var commonTokens = 0;
        
        tokens.forEach(function(token) {
          if (existingTokens.indexOf(token) !== -1) {
            commonTokens++;
          }
        });
        
        var similarity = commonTokens / Math.max(tokens.length, existingTokens.length);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      });
      
      var originalityScore = Math.round((1 - maxSimilarity) * 100);
      
      return { success: true, data: originalityScore, error: null };
    } catch (err) {
      return { success: false, data: 0, error: err.message };
    }
  }

  function calculateDepth(text) {
    try {
      var tokens = _tokenize(text);
      var sentences = text.split(/[.!?]+/).filter(function(s) { return s.trim().length > 0; });
      
      // Métricas de profundidade
      var wordCount = tokens.length;
      var sentenceCount = sentences.length;
      var avgWordsPerSentence = wordCount / Math.max(sentenceCount, 1);
      var uniqueWords = {};
      tokens.forEach(function(t) { uniqueWords[t] = true; });
      var vocabularyRichness = Object.keys(uniqueWords).length / Math.max(wordCount, 1);
      
      // Score composto
      var lengthScore = Math.min(100, (wordCount / 100) * 100);
      var complexityScore = Math.min(100, (avgWordsPerSentence / 20) * 100);
      var richnessScore = vocabularyRichness * 100;
      
      var depthScore = Math.round((lengthScore * 0.4) + (complexityScore * 0.3) + (richnessScore * 0.3));
      
      return {
        success: true,
        data: {
          score: depthScore,
          metrics: {
            wordCount: wordCount,
            sentenceCount: sentenceCount,
            avgWordsPerSentence: Math.round(avgWordsPerSentence),
            vocabularyRichness: Math.round(vocabularyRichness * 100)
          }
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function compareWithReference(text, reference) {
    try {
      var textTokens = _tokenize(text);
      var refTokens = _tokenize(reference);
      
      var commonTokens = 0;
      textTokens.forEach(function(token) {
        if (refTokens.indexOf(token) !== -1) {
          commonTokens++;
        }
      });
      
      var similarity = commonTokens / Math.max(textTokens.length, refTokens.length);
      var similarityScore = Math.round(similarity * 100);
      
      return {
        success: true,
        data: {
          similarity: similarityScore,
          commonTerms: commonTokens,
          totalTerms: textTokens.length
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function analyze(text, scenarioId) {
    try {
      // Análise local básica
      var keywordsResult = extractKeywords(text);
      var depthResult = calculateDepth(text);
      
      // Busca respostas existentes para calcular originalidade
      var interactionsResult = Utils.getAllRows('Interactions');
      var existingResponses = [];
      
      if (interactionsResult.success) {
        existingResponses = interactionsResult.data
          .filter(function(i) { return i.ScenarioID === scenarioId && i.Response; })
          .map(function(i) { return i.Response; })
          .slice(-20); // Últimas 20 respostas
      }
      
      var originalityResult = calculateOriginality(text, existingResponses);
      
      // Busca palavras-chave esperadas do cenário
      var expectedKeywords = [];
      if (typeof ScenarioController !== 'undefined') {
        var scenarioResult = ScenarioController.getScenarioById(scenarioId);
        if (scenarioResult.success && scenarioResult.data.Description) {
          expectedKeywords = _tokenize(scenarioResult.data.Description).slice(0, 5);
        }
      }
      
      var coherenceResult = calculateCoherence(text, expectedKeywords);
      
      // Tenta análise avançada via LLM se disponível
      var llmAnalysis = null;
      if (typeof LLMService !== 'undefined' && text.length > 50) {
        var llmResult = LLMService.evaluateResponse(text, scenarioId);
        if (llmResult.success) {
          llmAnalysis = llmResult.data;
        }
      }
      
      return {
        success: true,
        data: {
          coherence: coherenceResult.success ? coherenceResult.data : 70,
          originality: originalityResult.success ? originalityResult.data : 70,
          depth: depthResult.success ? depthResult.data.score : 70,
          keywords: keywordsResult.success ? keywordsResult.data : [],
          metrics: depthResult.success ? depthResult.data.metrics : {},
          llmAnalysis: llmAnalysis
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    analyze: analyze,
    calculateCoherence: calculateCoherence,
    calculateOriginality: calculateOriginality,
    calculateDepth: calculateDepth,
    extractKeywords: extractKeywords,
    compareWithReference: compareWithReference
  };
})();
