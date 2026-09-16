/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — TaxonomyService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Mapeamento taxonômico que relaciona fórmulas epistémicas com carreiras. Algoritmo central: vectores psicométricos → carreira recomendada via distância euclidiana.
 *
 * FUNCIONALIDADES:
 *   • calculateEpistemicFormula(dims) — Gera fórmula a partir de dimensões.
   • findBestMatch(dims) — Encontra carreira mais compatível.
   • getTopNMatches(dims, n) — Retorna top N carreiras.
   • calculateDistance(v1, v2) — Distância euclidiana.
   • getFormulaVector(formula) — Converte fórmula em vector.
   • normalizeDimensions(dims) — Normaliza vectores (soma=1).
   • getCrossDomainMatches(dims) — Carreiras multi-domínio.
 *
 * INTEGRAÇÕES:
 *   • VocationController — catálogo de 60 carreiras.
   • DimensionService — vectores psicométricos.
   • ResultService — gravação do resultado.
 * Euclidean distance matching — comparação de vectores multidimensionais.
   Normalized vectors — todos somam 1.0.
   Fórmula núcleo: 1/4 FIL, 1/4 PSI, 2/4 IA.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const TaxonomyService = (function () {

  var DIMENSION_KEYS = ['IA', 'FIL', 'PSI', 'NEU', 'BIO', 'FIS', 'SOC', 'ART'];

  function normalizeDimensions(dims) {
    if (typeof DimensionService !== 'undefined' && DimensionService.normalize) {
      return DimensionService.normalize(dims);
    }
    
    // Fallback se DimensionService não disponível
    try {
      var total = 0;
      DIMENSION_KEYS.forEach(function(key) {
        total += Number(dims[key] || 0);
      });
      
      if (total === 0) {
        return { success: false, data: null, error: 'Soma das dimensões é zero.' };
      }
      
      var normalized = {};
      DIMENSION_KEYS.forEach(function(key) {
        normalized[key] = Number(dims[key] || 0) / total;
      });
      
      return { success: true, data: normalized, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function calculateDistance(v1, v2) {
    try {
      var norm1 = normalizeDimensions(v1);
      var norm2 = normalizeDimensions(v2);
      
      if (!norm1.success || !norm2.success) {
        return { success: false, data: null, error: 'Erro ao normalizar vectores.' };
      }
      
      var sumSquares = 0;
      DIMENSION_KEYS.forEach(function(key) {
        var diff = norm1.data[key] - norm2.data[key];
        sumSquares += diff * diff;
      });
      
      return { success: true, data: Math.sqrt(sumSquares), error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getFormulaVector(formula) {
    if (typeof VocationController !== 'undefined' && VocationController.parseFormula) {
      return VocationController.parseFormula(formula);
    }
    
    // Fallback: parse simples
    try {
      var f = String(formula || '').trim().toUpperCase();
      if (!f) return { success: false, data: null, error: 'Fórmula vazia.' };
      
      var dimensions = {};
      var fractionPattern = /(\d+)\s*\/\s*4\s*([A-Z]+)/g;
      var compactPattern = /([A-Z]+)\s*:?\s*(\d+)/g;
      var match;
      while ((match = fractionPattern.exec(f)) !== null) dimensions[match[2]] = parseInt(match[1], 10);
      while ((match = compactPattern.exec(f)) !== null) dimensions[match[1]] = parseInt(match[2], 10);
      if (!Object.keys(dimensions).length) return { success: false, data: null, error: 'Fórmula inválida.' };
      return { success: true, data: dimensions, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function calculateEpistemicFormula(dims) {
    try {
      var normalized = normalizeDimensions(dims);
      if (!normalized.success) return normalized;
      
      // Ordena dimensões por valor decrescente
      var sorted = DIMENSION_KEYS.map(function(key) {
        return { key: key, value: normalized.data[key] };
      }).sort(function(a, b) {
        return b.value - a.value;
      });
      
      // Pega top 3 dimensões e gera fórmula
      var formula = [];
      for (var i = 0; i < Math.min(3, sorted.length); i++) {
        if (sorted[i].value > 0.1) { // Threshold mínimo 10%
          var level = Math.ceil(sorted[i].value * 5); // 0-1 → 1-5
          formula.push(sorted[i].key + level);
        }
      }
      
      return { success: true, data: formula.join(' '), error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function findBestMatch(dims) {
    try {
      if (typeof VocationController === 'undefined') {
        return { success: false, data: null, error: 'VocationController não disponível.' };
      }
      
      var vocationsResult = VocationController.getAllVocations();
      if (!vocationsResult.success) return vocationsResult;
      
      var activeVocations = vocationsResult.data.filter(function(v) {
        return v.Status === 'active';
      });
      
      if (activeVocations.length === 0) {
        return { success: false, data: null, error: 'Nenhuma vocação ativa disponível.' };
      }
      
      var bestMatch = null;
      var bestDistance = Infinity;
      
      activeVocations.forEach(function(vocation) {
        var formulaVector = getFormulaVector(vocation.Formula);
        if (!formulaVector.success) return;
        
        var distanceResult = calculateDistance(dims, formulaVector.data);
        if (!distanceResult.success) return;
        
        if (distanceResult.data < bestDistance) {
          bestDistance = distanceResult.data;
          bestMatch = vocation;
        }
      });
      
      if (!bestMatch) {
        return { success: false, data: null, error: 'Não foi possível encontrar correspondência.' };
      }
      
      // Calcula compatibilidade (0-100%)
      var compatibility = Math.max(0, (1 - (bestDistance / Math.sqrt(2))) * 100);
      
      return {
        success: true,
        data: {
          vocation: bestMatch,
          distance: bestDistance,
          compatibility: compatibility
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getTopNMatches(dims, n) {
    try {
      if (typeof VocationController === 'undefined') {
        return { success: false, data: [], error: 'VocationController não disponível.' };
      }
      
      var vocationsResult = VocationController.getAllVocations();
      if (!vocationsResult.success) return vocationsResult;
      
      var activeVocations = vocationsResult.data.filter(function(v) {
        return v.Status === 'active';
      });
      
      var matches = [];
      
      activeVocations.forEach(function(vocation) {
        var formulaVector = getFormulaVector(vocation.Formula);
        if (!formulaVector.success) return;
        
        var distanceResult = calculateDistance(dims, formulaVector.data);
        if (!distanceResult.success) return;
        
        var compatibility = Math.max(0, (1 - (distanceResult.data / Math.sqrt(2))) * 100);
        
        matches.push({
          vocation: vocation,
          distance: distanceResult.data,
          compatibility: compatibility
        });
      });
      
      // Ordena por compatibilidade decrescente
      matches.sort(function(a, b) {
        return b.compatibility - a.compatibility;
      });
      
      var topN = matches.slice(0, n || 5);
      
      return { success: true, data: topN, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function getCrossDomainMatches(dims) {
    try {
      var topMatches = getTopNMatches(dims, 10);
      if (!topMatches.success) return topMatches;
      
      // Agrupa por domínio
      var byDomain = {};
      topMatches.data.forEach(function(match) {
        var domain = match.vocation.Domain || 'Unknown';
        if (!byDomain[domain]) {
          byDomain[domain] = [];
        }
        byDomain[domain].push(match);
      });
      
      // Filtra apenas domínios com múltiplas correspondências
      var crossDomain = [];
      Object.keys(byDomain).forEach(function(domain) {
        if (byDomain[domain].length > 0) {
          crossDomain.push({
            domain: domain,
            matches: byDomain[domain],
            averageCompatibility: byDomain[domain].reduce(function(sum, m) {
              return sum + m.compatibility;
            }, 0) / byDomain[domain].length
          });
        }
      });
      
      // Ordena por compatibilidade média
      crossDomain.sort(function(a, b) {
        return b.averageCompatibility - a.averageCompatibility;
      });
      
      return { success: true, data: crossDomain, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  return {
    calculateEpistemicFormula: calculateEpistemicFormula,
    findBestMatch: findBestMatch,
    getTopNMatches: getTopNMatches,
    calculateDistance: calculateDistance,
    getFormulaVector: getFormulaVector,
    normalizeDimensions: normalizeDimensions,
    getCrossDomainMatches: getCrossDomainMatches
  };
})();
