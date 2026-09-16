/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — CacheController.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Controlador CRUD para gestão manual do cache persistente. Interface
 *   administrativa para inspeção, manipulação e estatísticas do cache quando
 *   AppCacheService atinge limites ou necessita persistência entre sessões.
 *
 * FUNCIONALIDADES:
 *   • getAllCached() — Lista todas entradas de cache (read).
 *   • getCachedItem(key) — Busca item específico por chave (read).
 *   • createCachedItem(key, value, ttl) — Cria entrada de cache (create).
 *   • updateCachedItem(key, value) — Atualiza valor existente (update).
 *   • deleteCachedItem(key) — Remove entrada de cache (delete).
 *   • clearAllCache() — Limpa todo o cache (memória + planilha).
 *   • getCacheStatistics() — Estatísticas de uso do cache.
 *   • pruneExpiredCache() — Remove entradas expiradas da planilha.
 *   • exportCacheSnapshot() — Exporta snapshot do cache em JSON.
 *
 * INTEGRAÇÕES:
 *   • AppCacheService — operações de cache (get, put, remove, clear).
 *   • Utils — acesso em lote à aba Cache.
 *   • ConfigService — leitura de CACHE_TTL padrão.
 *   • LoggerService — auditoria de operações administrativas.
 *
 * COLUNA DA PLANILHA (Cache):
 *   CacheKey | CacheValue | CreatedAt | ExpiresAt | Size
 *
 * PADRÕES:
 *   Batch read — Utils.getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *   Administrative interface — para uso em painéis de admin.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const CacheController = (function () {

  function _audit(action, details) {
    try {
      if (typeof LoggerService !== 'undefined' && LoggerService.log) {
        LoggerService.log('CACHE', action, details);
      }
    } catch (err) {
      // Auditoria é auxiliar.
    }
  }

  function getAllCached() {
    try {
      var result = Utils.getAllRows('Cache');
      if (!result.success) return result;
      
      var now = Date.now();
      var items = result.data.map(function (row) {
        var expiresAt = new Date(row.ExpiresAt).getTime();
        var isExpired = expiresAt < now;
        return {
          key: row.CacheKey,
          size: row.Size || (row.CacheValue ? String(row.CacheValue).length : 0),
          createdAt: row.CreatedAt,
          expiresAt: row.ExpiresAt,
          expired: isExpired,
          ttl: isExpired ? 0 : Math.round((expiresAt - now) / 1000)
        };
      });
      
      return { success: true, data: items, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getCachedItem(key) {
    if (!key) return { success: false, data: null, error: 'Chave de cache é obrigatória.' };
    
    try {
      var result = AppCacheService.get(key);
      if (!result.success) return result;
      
      if (result.data === null) {
        return { success: false, data: null, error: 'Item não encontrado no cache.' };
      }
      
      return {
        success: true,
        data: {
          key: key,
          value: result.data,
          size: JSON.stringify(result.data).length
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function createCachedItem(key, value, ttl) {
    if (!key) return { success: false, data: null, error: 'Chave de cache é obrigatória.' };
    if (value === undefined || value === null) {
      return { success: false, data: null, error: 'Valor de cache é obrigatório.' };
    }
    
    try {
      // Verifica se já existe
      var existing = AppCacheService.get(key);
      if (existing.success && existing.data !== null) {
        return { success: false, data: null, error: 'Item já existe. Use updateCachedItem para atualizar.' };
      }
      
      var result = AppCacheService.put(key, value, ttl);
      if (result.success) _audit('CACHE_CREATE', key);
      return result;
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function updateCachedItem(key, value, ttl) {
    if (!key) return { success: false, data: null, error: 'Chave de cache é obrigatória.' };
    if (value === undefined || value === null) {
      return { success: false, data: null, error: 'Valor de cache é obrigatório.' };
    }
    
    try {
      // Sobrescreve mesmo se não existir (comportamento de cache)
      var result = AppCacheService.put(key, value, ttl);
      if (result.success) _audit('CACHE_UPDATE', key);
      return result;
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function deleteCachedItem(key) {
    if (!key) return { success: false, data: null, error: 'Chave de cache é obrigatória.' };
    
    try {
      var result = AppCacheService.remove(key);
      if (result.success) _audit('CACHE_DELETE', key);
      return result;
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function clearAllCache() {
    try {
      var result = AppCacheService.clear();
      if (result.success) {
        _audit('CACHE_CLEAR_ALL', 'Cleared ' + result.data + ' keys');
      }
      return result;
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getCacheStatistics() {
    try {
      var result = Utils.getAllRows('Cache');
      if (!result.success) return result;
      
      var now = Date.now();
      var stats = {
        totalItems: result.data.length,
        activeItems: 0,
        expiredItems: 0,
        totalSize: 0,
        averageSize: 0,
        largestItem: null,
        oldestItem: null,
        newestItem: null
      };
      
      var largestSize = 0;
      var oldestDate = null;
      var newestDate = null;
      
      result.data.forEach(function (row) {
        var expiresAt = new Date(row.ExpiresAt).getTime();
        var size = row.Size || (row.CacheValue ? String(row.CacheValue).length : 0);
        var createdAt = new Date(row.CreatedAt);
        
        if (expiresAt >= now) {
          stats.activeItems++;
        } else {
          stats.expiredItems++;
        }
        
        stats.totalSize += size;
        
        if (size > largestSize) {
          largestSize = size;
          stats.largestItem = { key: row.CacheKey, size: size };
        }
        
        if (!oldestDate || createdAt < oldestDate) {
          oldestDate = createdAt;
          stats.oldestItem = { key: row.CacheKey, createdAt: row.CreatedAt };
        }
        
        if (!newestDate || createdAt > newestDate) {
          newestDate = createdAt;
          stats.newestItem = { key: row.CacheKey, createdAt: row.CreatedAt };
        }
      });
      
      stats.averageSize = stats.totalItems > 0 ? Math.round(stats.totalSize / stats.totalItems) : 0;
      
      return { success: true, data: stats, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function pruneExpiredCache() {
    try {
      var lock = LockService.getScriptLock();
      lock.waitLock(10000);
      
      var sheet = Utils.getSheet('Cache');
      if (!sheet) return { success: false, data: null, error: 'Aba Cache não encontrada.' };
      
      var values = sheet.getDataRange().getValues();
      if (values.length < 2) {
        lock.releaseLock();
        return { success: true, data: { removed: 0 }, error: null };
      }
      
      var headers = values[0];
      var expiresCol = headers.indexOf('ExpiresAt');
      if (expiresCol === -1) {
        lock.releaseLock();
        return { success: false, data: null, error: 'Coluna ExpiresAt não encontrada.' };
      }
      
      var now = Date.now();
      var removed = 0;
      
      // Remove de trás para frente para não desalinhar índices
      for (var i = values.length - 1; i >= 1; i--) {
        var expiresAt = new Date(values[i][expiresCol]).getTime();
        if (expiresAt < now) {
          sheet.deleteRow(i + 1);
          removed++;
        }
      }
      
      lock.releaseLock();
      _audit('CACHE_PRUNE', 'Removed ' + removed + ' expired items');
      
      return { success: true, data: { removed: removed }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function exportCacheSnapshot() {
    try {
      var result = Utils.getAllRows('Cache');
      if (!result.success) return result;
      
      var snapshot = {
        exportedAt: Utils.getTimestamp(),
        itemCount: result.data.length,
        items: result.data.map(function (row) {
          return {
            key: row.CacheKey,
            value: row.CacheValue,
            createdAt: row.CreatedAt,
            expiresAt: row.ExpiresAt,
            size: row.Size
          };
        })
      };
      
      return { success: true, data: snapshot, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    getAllCached: getAllCached,
    getCachedItem: getCachedItem,
    createCachedItem: createCachedItem,
    updateCachedItem: updateCachedItem,
    deleteCachedItem: deleteCachedItem,
    clearAllCache: clearAllCache,
    getCacheStatistics: getCacheStatistics,
    pruneExpiredCache: pruneExpiredCache,
    exportCacheSnapshot: exportCacheSnapshot
  };
})();
