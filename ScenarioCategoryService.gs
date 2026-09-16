/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — ScenarioCategoryService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Gestão de categorias temáticas de cenários: bioética, computação quântica, semiótica digital, neuroética, soberania de dados, arte generativa, planeamento urbano, healthtech.
 *
 * FUNCIONALIDADES:
 *   • getAllCategories() — Lista todas as categorias.
   • getCategoryByCode(code) — Busca categoria.
   • getScenariosInCategory(code) — Cenários de uma categoria.
   • getCategoryDescription(code) — Descrição da categoria.
   • countScenariosByCategory() — Contagem por categoria.
 *
 * INTEGRAÇÕES:
 *   • ScenarioController — cenários filtrados.
   • CacheService — cache de categorias.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — {{ success, data, error }}.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ScenarioCategoryService = (function () {
  var CATEGORIES = [
    { code: 'BIO', name: 'Bioética', description: 'Decisões sobre vida, saúde e responsabilidade científica.' },
    { code: 'TEC', name: 'Computação quântica', description: 'Tecnologia, algoritmos e limites da computação.' },
    { code: 'SEM', name: 'Semiótica digital', description: 'Linguagem, cultura e interpretação em ambientes digitais.' },
    { code: 'NEU', name: 'Neuroética', description: 'Consciência, cognição e impacto das tecnologias no ser humano.' },
    { code: 'DAT', name: 'Soberania de dados', description: 'Privacidade, governança e uso responsável de dados.' },
    { code: 'ART', name: 'Arte generativa', description: 'Criação artística, autoria e colaboração com sistemas inteligentes.' },
    { code: 'URB', name: 'Planeamento urbano', description: 'Cidades, mobilidade e decisões coletivas sustentáveis.' },
    { code: 'HEA', name: 'Healthtech', description: 'Inovação em saúde com foco em pessoas e equidade.' }
  ];

  function _ok(data) { return typeof ServiceResult !== 'undefined' ? ServiceResult.ok(data) : { success: true, data: data, error: null }; }
  function _fail(message, fallback) { return typeof ServiceResult !== 'undefined' ? ServiceResult.fail(message, fallback) : { success: false, data: fallback || null, error: message }; }
  function _copy(value) { return typeof Utils !== 'undefined' && Utils.deepCopy ? Utils.deepCopy(value) : JSON.parse(JSON.stringify(value)); }

  function getAllCategories() { return _ok(_copy(CATEGORIES)); }

  function getCategoryByCode(code) {
    var normalized = String(code || '').trim().toUpperCase();
    var category = CATEGORIES.filter(function (item) { return item.code === normalized; })[0];
    return category ? _ok(_copy(category)) : _fail('Categoria não encontrada.');
  }

  function getScenariosInCategory(code) {
    var category = getCategoryByCode(code);
    if (!category.success) return { success: true, data: [], error: null };
    try {
      if (typeof ScenarioController === 'undefined') return _fail('ScenarioController não disponível.', []);
      var result = ScenarioController.getAllScenarios();
      if (!result.success) return result;
      var normalized = String(code).trim().toUpperCase();
      return _ok(result.data.filter(function (scenario) {
        return String(scenario.Category || scenario.CategoryCode || '').toUpperCase() === normalized;
      }));
    } catch (err) { return _fail(err, []); }
  }

  function getCategoryDescription(code) {
    var result = getCategoryByCode(code);
    return result.success ? _ok(result.data.description) : result;
  }

  function countScenariosByCategory() {
    var counts = {};
    CATEGORIES.forEach(function (category) { counts[category.code] = 0; });
    var all = typeof ScenarioController !== 'undefined' && ScenarioController.getAllScenarios
      ? ScenarioController.getAllScenarios() : _ok([]);
    if (!all.success) return all;
    all.data.forEach(function (scenario) {
      var code = String(scenario.Category || scenario.CategoryCode || '').toUpperCase();
      if (Object.prototype.hasOwnProperty.call(counts, code)) counts[code] += 1;
    });
    return _ok(counts);
  }

  return {
    getAllCategories: getAllCategories,
    getCategoryByCode: getCategoryByCode,
    getScenariosInCategory: getScenariosInCategory,
    getCategoryDescription: getCategoryDescription,
    countScenariosByCategory: countScenariosByCategory
  };
})();
