/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — ResultChartService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Geração de gráficos e visualizações. Utiliza Charts API do Google para gráficos de vectores, comparações e evolução temporal.
 *
 * FUNCIONALIDADES:
 *   • generateRadarChart(userId) — Gráfico radar.
   • generateBarChart(dims) — Gráfico de barras.
   • generateLineChart(userId) — Evolução temporal.
   • generateComparisonChart(resultId) — Comparação.
   • generateDomainDistribution(userId) — Distribuição por domínio.
   • exportChartAsImage(chartId) — Exporta como imagem.
 *
 * INTEGRAÇÕES:
 *   • SpreadsheetApp — dados para gráficos.
   • Charts API (Google) — geração de gráficos.
   • DimensionService — vectores.
   • ResultController — resultados.
 * Charts API integration — gráficos nativos do Google.
   Client-side rendering — dados enviados ao frontend para Charts.js.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — {{ success, data, error }}.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ResultChartService = (function () {
  var DIMENSIONS = ['IA', 'FIL', 'PSI', 'NEU', 'BIO', 'FIS', 'SOC', 'ART'];
  function _ok(data) { return typeof ServiceResult !== 'undefined' ? ServiceResult.ok(data) : { success: true, data: data, error: null }; }
  function _fail(message, fallback) { return typeof ServiceResult !== 'undefined' ? ServiceResult.fail(message, fallback) : { success: false, data: fallback || null, error: message }; }
  function _values(dims) { return DIMENSIONS.map(function (key) { return Math.round((Number((dims || {})[key]) || 0) * 100) / 100; }); }
  function _getDimensions(userId) {
    if (!userId) return _fail('Utilizador é obrigatório.');
    if (typeof DimensionService === 'undefined' || !DimensionService.getAggregateVector) return _fail('DimensionService não disponível.');
    return DimensionService.getAggregateVector(userId);
  }
  function generateRadarChart(userId) {
    var result = _getDimensions(userId);
    return result.success ? _ok({ type: 'radar', labels: DIMENSIONS, values: _values(result.data), title: 'Perfil psicométrico' }) : result;
  }
  function generateBarChart(dims) {
    if (!dims || typeof dims !== 'object') return _fail('Dimensões inválidas.');
    return _ok({ type: 'bar', labels: DIMENSIONS, values: _values(dims), title: 'Dimensões comparadas' });
  }
  function generateLineChart(userId) {
    if (!userId) return _fail('Utilizador é obrigatório.');
    var rows = typeof ScoreController !== 'undefined' && ScoreController.getScoresByUser ? ScoreController.getScoresByUser(userId) : _ok([]);
    if (!rows.success) return rows;
    var points = rows.data.map(function (row, index) { return { x: row.CreatedAt || row.Timestamp || index + 1, y: Number(row.Score || 0) || 0 }; });
    return _ok({ type: 'line', labels: points.map(function (point) { return point.x; }), values: points.map(function (point) { return point.y; }), title: 'Evolução da pontuação' });
  }
  function generateComparisonChart(resultId) {
    if (!resultId) return _fail('Resultado é obrigatório.');
    if (typeof ResultController === 'undefined' || !ResultController.getResultById) return _fail('ResultController não disponível.');
    var result = ResultController.getResultById(resultId);
    if (!result.success) return result;
    var data = result.data || {};
    var userDims = data.Dimensions;
    if (typeof userDims === 'string') { try { userDims = JSON.parse(userDims); } catch (err) { return _fail('Dimensões do resultado inválidas.'); } }
    return generateBarChart(userDims || {});
  }
  function generateDomainDistribution(userId) {
    var radar = generateRadarChart(userId);
    if (!radar.success) return radar;
    var groups = { FIL: ['FIL'], PSI: ['PSI'], IA: ['IA'], NEU: ['NEU'], BIO: ['BIO'], FIS: ['FIS'], SOC: ['SOC'], ART: ['ART'] };
    var distribution = {};
    Object.keys(groups).forEach(function (domain) { distribution[domain] = radar.data.values[DIMENSIONS.indexOf(groups[domain][0])] || 0; });
    return _ok({ type: 'distribution', labels: Object.keys(distribution), values: Object.keys(distribution).map(function (key) { return distribution[key]; }), data: distribution });
  }
  function exportChartAsImage(chartId) {
    var id = String(chartId || '').trim();
    if (!id) return _fail('Identificador do gráfico é obrigatório.');
    return _ok({ chartId: id, format: 'png', mode: 'client-export', message: 'A exportação visual deve ser concluída pelo cliente.' });
  }
  return { generateRadarChart: generateRadarChart, generateBarChart: generateBarChart, generateLineChart: generateLineChart, generateComparisonChart: generateComparisonChart, generateDomainDistribution: generateDomainDistribution, exportChartAsImage: exportChartAsImage };
})();
