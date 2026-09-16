/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — DomainController.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Controlador CRUD para os 6 domínios vocacionais (A-F). Agrupa carreiras por afinidade temática.
 *
 * FUNCIONALIDADES:
 *   • createDomain(data) — Cria domínio.
   • getAllDomains() — Lista os 6 domínios (read).
   • getDomainByCode(code) — Busca por código A-F (read).
   • updateDomain(code, data) — Atualiza (update).
   • getVocationsInDomain(code) — Lista vocações do domínio.
   • getDomainStatistics(code) — Estatísticas do domínio.
   • reorderDomains(order) — Reordena domínios.
 *
 * INTEGRAÇÕES:
 *   • SpreadsheetApp — aba Taxonomy.
   • VocationController — vocações por domínio.
   • CacheService — cache de domínios.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const DomainController = (function () {

  var CACHE_KEY = 'domains:all';
  var CACHE_TTL = 3600;

  function _getCachedDomains() {
    try {
      if (typeof AppCacheService !== 'undefined' && AppCacheService.getOrFetch) {
        return AppCacheService.getOrFetch(CACHE_KEY, function() {
          var result = Utils.getAllRows('Domains');
          if (!result.success) {
            if (typeof Logger !== 'undefined') {
              Logger.log('[DomainController] Erro ao carregar domínios: ' + result.error);
            }
            return [];
          }
          return result.data;
        }, CACHE_TTL);
      }
      var result = Utils.getAllRows('Domains');
      return result.success ? result.data : [];
    } catch (err) {
      return [];
    }
  }

  function _invalidateCache() {
    try {
      if (typeof AppCacheService !== 'undefined' && AppCacheService.remove) {
        AppCacheService.remove(CACHE_KEY);
      }
    } catch (err) {
      // Cache é otimização
    }
  }

  function createDomain(data) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      
      var code = String(data.code || '').toUpperCase();
      if (!code || code.length !== 1 || code < 'A' || code > 'F') {
        return { success: false, data: null, error: 'Código deve ser A, B, C, D, E ou F.' };
      }
      
      var domainData = {
        DomainCode: code,
        Name: String(data.name || '').trim(),
        Description: String(data.description || '').trim(),
        Color: String(data.color || '#000000'),
        Order: Number(data.order || 0),
        Status: String(data.status || 'active')
      };
      
      if (!domainData.Name || domainData.Name.length < 3) {
        return { success: false, data: null, error: 'Nome do domínio é obrigatório (mín. 3 caracteres).' };
      }
      
      var result = Utils.addRow('Domains', domainData);
      if (!result.success) return result;
      
      _invalidateCache();
      
      return { success: true, data: { domainCode: code }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function getAllDomains() {
    try {
      var domains = _getCachedDomains();
      domains.sort(function(a, b) {
        return (a.Order || 0) - (b.Order || 0);
      });
      return { success: true, data: domains, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function getDomainByCode(code) {
    try {
      var domains = _getCachedDomains();
      var normalized = String(code || '').toUpperCase();
      
      var domain = domains.filter(function(d) {
        return d.DomainCode === normalized;
      })[0];
      
      if (!domain) {
        return { success: false, data: null, error: 'Domínio não encontrado.' };
      }
      
      return { success: true, data: domain, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function updateDomain(code, data) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('Domains');
      if (!sheet) return { success: false, data: null, error: 'Aba Domains não encontrada.' };
      
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var codeCol = headers.indexOf('DomainCode');
      if (codeCol === -1) return { success: false, data: null, error: 'Coluna DomainCode não encontrada.' };
      
      var normalized = String(code || '').toUpperCase();
      var rowIndex = -1;
      for (var i = 1; i < values.length; i++) {
        if (values[i][codeCol] === normalized) {
          rowIndex = i;
          break;
        }
      }
      if (rowIndex === -1) {
        return { success: false, data: null, error: 'Domínio não encontrado.' };
      }
      
      var updatableFields = ['Name', 'Description', 'Color', 'Order', 'Status'];
      updatableFields.forEach(function(field) {
        var colIndex = headers.indexOf(field);
        if (colIndex !== -1 && data[field] !== undefined) {
          values[rowIndex][colIndex] = data[field];
        }
      });
      
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      _invalidateCache();
      
      return { success: true, data: { domainCode: normalized }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function getVocationsInDomain(code) {
    try {
      if (typeof VocationController === 'undefined') {
        return { success: false, data: [], error: 'VocationController não disponível.' };
      }
      return VocationController.getVocationsByDomain(code);
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function getDomainStatistics(code) {
    try {
      var vocationsResult = getVocationsInDomain(code);
      if (!vocationsResult.success) {
        return { success: false, data: null, error: vocationsResult.error };
      }
      
      var vocations = vocationsResult.data;
      var totalVocations = vocations.length;
      var activeVocations = vocations.filter(function(v) {
        return v.Status === 'active';
      }).length;
      
      return {
        success: true,
        data: {
          domainCode: code,
          totalVocations: totalVocations,
          activeVocations: activeVocations,
          inactiveVocations: totalVocations - activeVocations
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function reorderDomains(order) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      
      if (!Array.isArray(order) || order.length === 0) {
        return { success: false, data: null, error: 'Order deve ser array de códigos.' };
      }
      
      var sheet = Utils.getSheet('Domains');
      if (!sheet) return { success: false, data: null, error: 'Aba Domains não encontrada.' };
      
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var codeCol = headers.indexOf('DomainCode');
      var orderCol = headers.indexOf('Order');
      
      if (codeCol === -1 || orderCol === -1) {
        return { success: false, data: null, error: 'Colunas necessárias não encontradas.' };
      }
      
      order.forEach(function(code, index) {
        for (var i = 1; i < values.length; i++) {
          if (values[i][codeCol] === code) {
            values[i][orderCol] = index;
            break;
          }
        }
      });
      
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      _invalidateCache();
      
      return { success: true, data: { reordered: order.length }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  return {
    createDomain: createDomain,
    getAllDomains: getAllDomains,
    getDomainByCode: getDomainByCode,
    updateDomain: updateDomain,
    getVocationsInDomain: getVocationsInDomain,
    getDomainStatistics: getDomainStatistics,
    reorderDomains: reorderDomains
  };
})();
