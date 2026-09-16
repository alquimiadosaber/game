/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — ConfigService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Serviço centralizado de configuração do sistema. Gerencia variáveis de
 *   ambiente (PropertiesService), lê configurações da aba Settings e fornece
 *   acesso tipado a cada parâmetro. Configurações da aba Settings são
 *   cacheadas (via CacheService.gs / AppCacheService) quando disponível.
 *
 * FUNCIONALIDADES:
 *   • get(key) — Recupera propriedade do documento (com defaults).
 *   • set(key, value) — Define propriedade do documento.
 *   • getSpreadsheetId() — Retorna SPREADSHEETS_ID.
 *   • getSetting(name) — Lê configuração da aba Settings (tipada).
 *   • setSetting(name, value) — Atualiza/cria configuração.
 *   • getAllSettings() — Retorna todas as configurações.
 *   • isFeatureEnabled(featureName) — Verifica funcionalidade ativa.
 *
 * INTEGRAÇÕES:
 *   • PropertiesService (DocumentProperties) — variáveis de ambiente.
 *   • Utils — leitura/escrita em lote na aba Settings.
 *   • AppCacheService — cache das configurações (opcional, degrada bem se ausente).
 *   • LoggerService — registro de alterações (opcional, degrada bem se ausente).
 *
 * VARIÁVEIS DE AMBIENTE COM DEFAULT:
 *   CACHE_TTL=21600, BATCH_SIZE=1000, MAX_SESSION_DURATION=60,
 *   TRIGGER_QUOTA_MINUTES=90. SPREADSHEETS_ID, ADMIN_EMAIL, LLM_API_KEY e
 *   LLM_BASE_URL não têm default — devem ser configurados manualmente.
 *
 * PADRÕES:
 *   Batch read — Utils.getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *   Dependências de outros serviços (AppCacheService, LoggerService) são
 *   sempre opcionais/defensivas (verificação de tipo antes de chamar), para
 *   que ConfigService funcione mesmo antes de esses serviços existirem.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ConfigService = (function () {

  var ENV_DEFAULTS = {
    CACHE_TTL: '21600',
    BATCH_SIZE: '1000',
    MAX_SESSION_DURATION: '60',
    TRIGGER_QUOTA_MINUTES: '90'
  };

  var SETTINGS_CACHE_KEY = 'config:settings_map';
  var SETTINGS_CACHE_TTL = 300;

  function _audit(action, details) {
    try {
      if (typeof LoggerService !== 'undefined' && LoggerService.log) {
        LoggerService.log('CONFIG', 'system', Object.assign({ action: action }, details || {}));
      }
    } catch (err) {
      // Log é auxiliar; falha aqui nunca deve quebrar a configuração.
    }
  }

  function get(key) {
    var value = PropertiesService.getDocumentProperties().getProperty(key);
    if (value === null || value === undefined) {
      return Object.prototype.hasOwnProperty.call(ENV_DEFAULTS, key) ? ENV_DEFAULTS[key] : null;
    }
    return value;
  }

  function set(key, value) {
    try {
      PropertiesService.getDocumentProperties().setProperty(key, String(value));
      _audit('ENV_SET', { key: key });
      return { success: true, data: { key: key, value: value }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getSpreadsheetId() {
    return get('SPREADSHEETS_ID');
  }

  function _coerce(value, type) {
    switch (String(type || '').toLowerCase()) {
      case 'number':
        return Number(value);
      case 'boolean':
        return value === true || value === 'true' || value === 1 || value === '1';
      case 'json':
        try {
          return JSON.parse(value);
        } catch (err) {
          return null;
        }
      default:
        return value;
    }
  }

  function _loadSettingsMap() {
    try {
      var loader = function () {
        var result = Utils.getAllRows('Settings');
        if (!result.success) {
          if (typeof Logger !== 'undefined') {
            Logger.log('[ConfigService] Erro ao carregar configurações: ' + result.error);
          }
          return {};
        }
        return Utils.arrayToMap(result.data, 'SettingKey');
      };
      // AppCacheService pode não existir ainda em ambientes parcialmente
      // implementados — degrade graciosamente para leitura direta.
      if (typeof AppCacheService !== 'undefined' && AppCacheService.getOrFetch) {
        return { success: true, data: AppCacheService.getOrFetch(SETTINGS_CACHE_KEY, loader, SETTINGS_CACHE_TTL), error: null };
      }
      return { success: true, data: loader(), error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function _invalidateSettingsCache() {
    try {
      if (typeof AppCacheService !== 'undefined' && AppCacheService.remove) {
        AppCacheService.remove(SETTINGS_CACHE_KEY);
      }
    } catch (err) {
      // Cache é otimização; falha ao invalidar não é crítica.
    }
  }

  function getSetting(name) {
    var map = _loadSettingsMap();
    if (!map.success) return map;
    var setting = map.data[name];
    if (!setting) return { success: false, data: null, error: 'Configuração "' + name + '" não encontrada.' };
    return { success: true, data: _coerce(setting.SettingValue, setting.Type), error: null };
  }

  function setSetting(name, value) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('Settings');
      if (!sheet) return { success: false, data: null, error: 'Aba Settings não encontrada.' };
      var data = sheet.getDataRange().getValues();
      var headers = data[0] || [];
      var keyCol = headers.indexOf('SettingKey');
      var valueCol = headers.indexOf('SettingValue');
      if (keyCol === -1 || valueCol === -1) {
        return { success: false, data: null, error: 'Cabeçalho da aba Settings inválido (esperado SettingKey/SettingValue).' };
      }
      var rowIndex = -1;
      for (var i = 1; i < data.length; i++) {
        if (data[i][keyCol] === name) { rowIndex = i; break; }
      }
      if (rowIndex === -1) {
        var newRow = headers.map(function (h) {
          if (h === 'SettingKey') return name;
          if (h === 'SettingValue') return value;
          if (h === 'Description') return 'Configuração criada por ConfigService.';
          if (h === 'Category') return 'General';
          if (h === 'Type') return 'string';
          if (h === 'CreatedAt' || h === 'UpdatedAt') return Utils.getTimestamp();
          if (h === 'UpdatedBy') return 'ConfigService';
          return '';
        });
        sheet.getRange(data.length + 1, 1, 1, headers.length).setValues([newRow]);
      } else {
        data[rowIndex][valueCol] = value;
        var updatedAtCol = headers.indexOf('UpdatedAt');
        if (updatedAtCol !== -1) data[rowIndex][updatedAtCol] = Utils.getTimestamp();
        sheet.getRange(1, 1, data.length, headers.length).setValues(data);
      }
      _invalidateSettingsCache();
      _audit('SETTING_UPDATE', { name: name });
      return { success: true, data: { name: name, value: value }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function getAllSettings() {
    var map = _loadSettingsMap();
    if (!map.success) return map;
    var list = Object.keys(map.data).map(function (k) { return map.data[k]; });
    return { success: true, data: list, error: null };
  }

  function isFeatureEnabled(featureName) {
    var setting = getSetting(featureName);
    if (!setting.success) return false;
    var v = setting.data;
    return v === true || v === 'true' || v === 1 || v === '1';
  }

  return {
    get: get,
    set: set,
    getSpreadsheetId: getSpreadsheetId,
    getSetting: getSetting,
    setSetting: setSetting,
    getAllSettings: getAllSettings,
    isFeatureEnabled: isFeatureEnabled
  };
})();
