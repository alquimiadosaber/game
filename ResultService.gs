/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — ResultService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Algoritmo de matching vocacional. Pipeline completo: coleta vectores, calcula compatibilidade com 60 carreiras, seleciona melhor vocação.
 *
 * FUNCIONALIDADES:
 *   • generateResult(userId) — Gera resultado vocacional.
   • calculateVocationMatch(dims) — Matching com todas as vocações.
   • selectBestVocation(matches) — Seleciona melhor opção.
   • generateAlternatives(matches, top, exclude) — Vocações alternativas.
   • calculateConfidence(match) — Nível de confiança.
   • generateReport(userId) — Gera relatório individual.
 *
 * INTEGRAÇÕES:
 *   • TaxonomyService — distância euclidiana.
   • DimensionService — vectores do utilizador.
   • VocationController — catálogo de 60 carreiras.
   • ResultController — gravação do resultado.
   • ReportService — geração de relatório PDF.
 * Pipeline pattern — sequência de passos.
   Confidence scoring — nível de confiança baseado em distância.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — {{ success, data, error }}.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ResultService = (function () {
  function _ok(data) { return typeof ServiceResult !== 'undefined' ? ServiceResult.ok(data) : { success: true, data: data, error: null }; }
  function _fail(message, fallback) { return typeof ServiceResult !== 'undefined' ? ServiceResult.fail(message, fallback) : { success: false, data: fallback || null, error: message }; }
  function _matches(dims, limit) {
    if (typeof TaxonomyService !== 'undefined' && TaxonomyService.getTopNMatches) return TaxonomyService.getTopNMatches(dims, limit || 10);
    return _fail('TaxonomyService não disponível.', []);
  }
  function calculateVocationMatch(dims) {
    if (!dims || typeof dims !== 'object') return _fail('Dimensões inválidas.', []);
    var result = _matches(dims, 10);
    return result.success ? _ok(result.data) : result;
  }
  function selectBestVocation(matches) {
    if (!Array.isArray(matches) || !matches.length) return _fail('Nenhuma correspondência encontrada.');
    var sorted = matches.slice().sort(function (a, b) { return Number(b.compatibility || 0) - Number(a.compatibility || 0); });
    return _ok(sorted[0]);
  }
  function generateAlternatives(matches, top, exclude) {
    if (!Array.isArray(matches)) return _fail('Correspondências inválidas.', []);
    var excluded = String(exclude || ''); var limit = Math.max(1, Math.min(20, parseInt(top, 10) || 5));
    return _ok(matches.filter(function (item) { return !excluded || String(item.vocation && (item.vocation.VocationID || item.vocation.Id)) !== excluded; }).slice(0, limit));
  }
  function calculateConfidence(match) {
    if (!match) return _fail('Correspondência inválida.');
    var compatibility = Math.max(0, Math.min(100, Number(match.compatibility) || 0));
    return _ok({ score: Math.round(compatibility), level: compatibility >= 80 ? 'high' : compatibility >= 60 ? 'medium' : 'low' });
  }
  function generateResult(userId) {
    if (!userId) return _fail('Utilizador é obrigatório.');
    if (typeof DimensionService === 'undefined' || !DimensionService.getAggregateVector) return _fail('DimensionService não disponível.');
    var dimensions = DimensionService.getAggregateVector(userId); if (!dimensions.success) return dimensions;
    var matches = calculateVocationMatch(dimensions.data); if (!matches.success) return matches;
    var best = selectBestVocation(matches.data); if (!best.success) return best;
    var confidence = calculateConfidence(best.data);
    var alternatives = generateAlternatives(matches.data, 5, best.data.vocation && best.data.vocation.VocationID);
    var data = { userId: userId, dimensions: dimensions.data, recommended: best.data, confidence: confidence.data, alternatives: alternatives.data, generatedAt: new Date().toISOString() };
    if (typeof ResultController !== 'undefined' && ResultController.createResult && best.data.vocation) {
      var saved = ResultController.createResult({ userId: userId, vocationId: best.data.vocation.VocationID, recommendedVocation: best.data.vocation.Title || '', domain: best.data.vocation.Domain || '', compatibility: best.data.compatibility, score: best.data.compatibility, dimensions: JSON.stringify(dimensions.data) });
      if (saved.success) data.resultId = saved.data.resultId;
    }
    return _ok(data);
  }
  function generateReport(userId) {
    var result = generateResult(userId); if (!result.success) return result;
    if (typeof ReportService !== 'undefined' && ReportService.generateIndividualReport) {
      var report = ReportService.generateIndividualReport(userId); if (report.success) return report;
    }
    return _ok({ userId: userId, result: result.data, format: 'json' });
  }
  return { generateResult: generateResult, calculateVocationMatch: calculateVocationMatch, selectBestVocation: selectBestVocation, generateAlternatives: generateAlternatives, calculateConfidence: calculateConfidence, generateReport: generateReport };
})();
