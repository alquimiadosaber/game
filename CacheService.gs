/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — CacheService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Wrapper do CacheService nativo do GAS. Fornece camada de abstração com TTL
 *   configurável, serialização JSON e fallback para a aba Cache da planilha
 *   quando o valor excede o limite de 100 KB por chave do CacheService nativo.
 *
 * NOTA DE NOMENCLATURA (importante):
 *   O objeto exportado por este arquivo chama-se AppCacheService, e não
 *   "CacheService" — esse nome já pertence à classe global nativa do Google
 *   Apps Script (CacheService.getScriptCache()). Declarar um `const
 *   CacheService` aqui sombrearia a classe nativa em todo o projeto e
 *   quebraria qualquer chamada a CacheService.getScriptCache(), inclusive as
 *   deste próprio arquivo. Outros serviços devem referenciar AppCacheService.
 *
 * FUNCIONALIDADES:
 *   • get(key) — Recupera valor do cache (JSON).
 *   • put(key, value, ttlSeconds) — Armazena valor com TTL (máx. 21600s/6h).
 *   • remove(key) — Remove chave do cache (memória + planilha).
 *   • getOrFetch(key, fetchFn, ttlSeconds) — Pattern cache-aside; retorna o
 *     valor diretamente (não o envelope { success, data, error }), pois é
 *     pensada para uso like um accessor comum: `var x = AppCacheService
 *     .getOrFetch('k', loader, 3600);`.
 *   • clear() — Limpa todo o cache (memória + planilha).
 *   • syncToSheet() — Persiste snapshot das chaves ativas na aba Cache.
 *   • loadFromSheet() — Rehidrata o cache nativo a partir da aba Cache.
 *
 * INTEGRAÇÕES:
 *   • CacheService (nativa Google) — armazenamento em memória, via
 *     CacheService.getScriptCache().
 *   • ConfigService — leitura de CACHE_TTL (opcional/defensiva).
 *   • Utils — leitura em lote e acesso à aba Cache.
 *   • PropertiesService — índice de chaves ativas (__CACHE_INDEX__).
 *
 * COLUNA DA PLANILHA (Cache): A: CacheKey | B: CacheValue | C: CreatedAt | D: ExpiresAt | E: Size
 *
 * PADRÕES:
 *   Cache-aside — a aba Cache só é usada quando o valor não cabe no
 *   CacheService nativo (>100KB) ou após uma chamada explícita a
 *   syncToSheet(); put()/get() normais não tocam a planilha, para não anular
 *   o ganho de performance do cache em memória.
 *   TTL-based expiration — chaves expiram automaticamente (máx. 6h nativo).
 *   Service result pattern — { success, data, error }, exceto getOrFetch()
 *   (ver nota acima).
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const AppCacheService = (function () {

  var NATIVE_MAX_TTL_SECONDS = 21600; // limite do CacheService nativo (6h)
  var NATIVE_MAX_BYTES = 90000; // margem de segurança abaixo do limite de 100KB/chave
  var CACHE_INDEX_PROP = '__CACHE_INDEX__';

  // Não chamar ConfigService no momento da construção deste módulo: a ordem
  // de carregamento dos arquivos .gs no projeto não é garantida, então
  // qualquer dependência entre serviços deve ser resolvida dentro de uma
  // função (chamada em tempo de execução), nunca no corpo do IIFE.
  function _defaultTtl() {
    try {
      if (typeof ConfigService !== 'undefined' && ConfigService.get) {
        var n = parseInt(ConfigService.get('CACHE_TTL'), 10);
        if (!isNaN(n) && n > 0) return Math.min(n, NATIVE_MAX_TTL_SECONDS);
      }
    } catch (err) {
      // Cai para o padrão local.
    }
    return NATIVE_MAX_TTL_SECONDS;
  }

  function _indexList() {
    try {
      var raw = PropertiesService.getDocumentProperties().getProperty(CACHE_INDEX_PROP);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  function _indexSave(list) {
    try {
      PropertiesService.getDocumentProperties().setProperty(CACHE_INDEX_PROP, JSON.stringify(list));
    } catch (err) {
      // Índice é apenas otimização para clear()/syncToSheet(); falha aqui não é crítica.
    }
  }

  function _indexAdd(key) {
    var list = _indexList();
    if (list.indexOf(key) === -1) {
      list.push(key);
      _indexSave(list);
    }
  }

  function _indexRemove(key) {
    _indexSave(_indexList().filter(function (k) { return k !== key; }));
  }

  function _remainingSeconds(expiresAtIso) {
    var ms = new Date(expiresAtIso).getTime() - Date.now();
    return Math.max(0, Math.round(ms / 1000));
  }

  function _writeToSheet(key, serializedValue, expiresAtIso) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('Cache');
      if (!sheet) return; // aba opcional: sem ela o cache funciona só em memória
      var values = sheet.getDataRange().getValues();
      var headers = values[0] && values[0].length ? values[0] : ['CacheKey', 'CacheValue', 'CreatedAt', 'ExpiresAt', 'Size'];
      var keyCol = headers.indexOf('CacheKey');
      var rowIndex = -1;
      for (var i = 1; i < values.length; i++) {
        if (values[i][keyCol] === key) { rowIndex = i; break; }
      }
      var rowValues = [key, serializedValue, new Date().toISOString(), expiresAtIso, serializedValue.length];
      if (rowIndex === -1) {
        sheet.appendRow(rowValues);
      } else {
        sheet.getRange(rowIndex + 1, 1, 1, rowValues.length).setValues([rowValues]);
      }
    } finally {
      lock.releaseLock();
    }
  }

  function _readFromSheet(key) {
    var sheet = Utils.getSheet('Cache');
    if (!sheet) return null;
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) return null;
    var headers = values[0];
    var keyCol = headers.indexOf('CacheKey');
    var valueCol = headers.indexOf('CacheValue');
    var expiresCol = headers.indexOf('ExpiresAt');
    for (var i = 1; i < values.length; i++) {
      if (values[i][keyCol] === key) {
        try {
          return { value: JSON.parse(values[i][valueCol]), expiresAt: values[i][expiresCol] };
        } catch (err) {
          return null;
        }
      }
    }
    return null;
  }

  function _deleteFromSheet(key) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('Cache');
      if (!sheet) return;
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var keyCol = headers.indexOf('CacheKey');
      for (var i = values.length - 1; i >= 1; i--) {
        if (values[i][keyCol] === key) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
    } finally {
      lock.releaseLock();
    }
  }

  function _clearSheet() {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('Cache');
      if (!sheet) return;
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).clearContent();
      }
    } finally {
      lock.releaseLock();
    }
  }

  function get(key) {
    try {
      var raw = CacheService.getScriptCache().get(key);
      if (raw !== null) {
        return { success: true, data: JSON.parse(raw), error: null };
      }
      var fallback = _readFromSheet(key);
      if (fallback) {
        var remaining = _remainingSeconds(fallback.expiresAt);
        if (remaining > 0) {
          try {
            CacheService.getScriptCache().put(key, JSON.stringify(fallback.value), Math.min(remaining, NATIVE_MAX_TTL_SECONDS));
          } catch (err) {
            // Valor grande demais para o cache nativo; permanece servido pela planilha.
          }
          return { success: true, data: fallback.value, error: null };
        }
        _deleteFromSheet(key);
        _indexRemove(key);
      }
      return { success: true, data: null, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function put(key, value, ttlSeconds) {
    try {
      var ttl = Math.min(ttlSeconds || _defaultTtl(), NATIVE_MAX_TTL_SECONDS);
      var serialized = JSON.stringify(value);
      var storedNatively = false;
      if (serialized.length <= NATIVE_MAX_BYTES) {
        try {
          CacheService.getScriptCache().put(key, serialized, ttl);
          storedNatively = true;
        } catch (err) {
          storedNatively = false;
        }
      }
      _indexAdd(key);
      if (!storedNatively) {
        var expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
        _writeToSheet(key, serialized, expiresAt);
      }
      return { success: true, data: { key: key, ttl: ttl, storedNatively: storedNatively }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function remove(key) {
    try {
      CacheService.getScriptCache().remove(key);
      _deleteFromSheet(key);
      _indexRemove(key);
      return { success: true, data: null, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getOrFetch(key, fetchFn, ttlSeconds) {
    var cached = get(key);
    if (cached.success && cached.data !== null && cached.data !== undefined) {
      return cached.data;
    }
    var fresh = fetchFn();
    put(key, fresh, ttlSeconds);
    return fresh;
  }

  function clear() {
    try {
      var keys = _indexList();
      Utils.chunkArray(keys, 100).forEach(function (chunk) {
        if (chunk.length) CacheService.getScriptCache().removeAll(chunk);
      });
      _clearSheet();
      _indexSave([]);
      return { success: true, data: keys.length, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function syncToSheet() {
    try {
      var keys = _indexList();
      var cache = CacheService.getScriptCache();
      var written = 0;
      keys.forEach(function (key) {
        var raw = cache.get(key);
        if (raw !== null) {
          var expiresAt = new Date(Date.now() + _defaultTtl() * 1000).toISOString();
          _writeToSheet(key, raw, expiresAt);
          written++;
        }
      });
      return { success: true, data: written, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function loadFromSheet() {
    try {
      var result = Utils.getAllRows('Cache');
      if (!result.success) return result;
      var cache = CacheService.getScriptCache();
      var now = Date.now();
      var restored = 0;
      result.data.forEach(function (row) {
        var remaining = Math.round((new Date(row.ExpiresAt).getTime() - now) / 1000);
        if (remaining > 0) {
          try {
            cache.put(row.CacheKey, row.CacheValue, Math.min(remaining, NATIVE_MAX_TTL_SECONDS));
            _indexAdd(row.CacheKey);
            restored++;
          } catch (err) {
            // Valor grande demais para o cache nativo; permanece só na planilha.
          }
        }
      });
      return { success: true, data: restored, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    get: get,
    put: put,
    remove: remove,
    getOrFetch: getOrFetch,
    clear: clear,
    syncToSheet: syncToSheet,
    loadFromSheet: loadFromSheet
  };
})();
