/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — SettingsController.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Controlador CRUD para configurações do sistema. Gerencia settings na aba
 *   Settings com sincronização para ConfigService e cache invalidation.
 *
 * FUNCIONALIDADES:
 *   • getAllSettings() — Lista todas configurações (read).
 *   • getSetting(key) — Busca por chave (read).
 *   • updateSetting(key, value) — Atualiza valor (update).
 *   • createSetting(key, value, description) — Cria nova setting (create).
 *   • deleteSetting(key) — Remove setting (delete).
 *   • exportSettings() — Exporta todas em JSON.
 *   • importSettings(data) — Importa settings em lote.
 *   • resetToDefaults() — Restaura configurações padrão.
 *   • getSettingsByCategory(category) — Filtra por categoria.
 *
 * INTEGRAÇÕES:
 *   • Utils — acesso à aba Settings.
 *   • ConfigService — sincronização com PropertiesService.
 *   • AppCacheService — invalidação de cache após mudanças.
 *   • LoggerService — auditoria de alterações.
 *
 * PADRÕES:
 *   Batch read — Utils.getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *   Sync on write — sincroniza com PropertiesService após alterações.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const SettingsController = (function () {

  var DEFAULT_SETTINGS = {
    'APP_NAME': { value: 'Alquimia do Saber', description: 'Nome da aplicação', category: 'General' },
    'APP_VERSION': { value: '1.0.0', description: 'Versão da aplicação', category: 'General' },
    'CACHE_TTL': { value: '3600', description: 'TTL padrão de cache (segundos)', category: 'Performance' },
    'BATCH_SIZE': { value: '100', description: 'Tamanho de lote para operações', category: 'Performance' },
    'MAX_SESSION_DURATION': { value: '86400', description: 'Duração máxima de sessão (segundos)', category: 'Security' },
    'MIN_PASSWORD_LENGTH': { value: '8', description: 'Comprimento mínimo de senha', category: 'Security' },
    'ADMIN_EMAIL': { value: '', description: 'Email do administrador', category: 'Notifications' },
    'EMAIL_DAILY_LIMIT': { value: '100', description: 'Limite diário de emails', category: 'Notifications' },
    'XP_PER_LEVEL': { value: '100', description: 'XP necessário por nível', category: 'Gamification' },
    'MAX_LEVEL': { value: '50', description: 'Nível máximo do sistema', category: 'Gamification' },
    'LOG_RETENTION_DAYS': { value: '90', description: 'Dias de retenção de logs', category: 'Maintenance' },
    'FEATURE_LLM_ENABLED': { value: 'true', description: 'Habilitar análise por LLM', category: 'Features' }
  };

  function _audit(action, key, actorId) {
    try {
      if (typeof LoggerService !== 'undefined' && LoggerService.logCRUD) {
        LoggerService.logCRUD('Settings', action, key, actorId || 'system');
      }
    } catch (err) {
      // Auditoria é auxiliar
    }
  }

  function _syncToProperties(key, value) {
    try {
      if (typeof ConfigService !== 'undefined' && ConfigService.set) {
        ConfigService.set(key, value);
      }
    } catch (err) {
      // Sync é opcional
    }
  }

  function _invalidateCache(key) {
    try {
      if (typeof AppCacheService !== 'undefined') {
        AppCacheService.remove('setting_' + key);
        AppCacheService.remove('all_settings');
      }
    } catch (err) {
      // Cache é opcional
    }
  }

  function getAllSettings() {
    try {
      var result = Utils.getAllRows('Settings');
      if (!result.success) return result;
      
      var settings = result.data.map(function(row) {
        return {
          key: row.Key || row.SettingKey,
          value: row.Value || row.SettingValue,
          description: row.Description,
          category: row.Category || 'General',
          updatedAt: row.UpdatedAt,
          updatedBy: row.UpdatedBy
        };
      });
      
      return { success: true, data: settings, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getSetting(key) {
    if (!key) return { success: false, data: null, error: 'Key é obrigatória.' };
    
    try {
      var allResult = getAllSettings();
      if (!allResult.success) return allResult;
      
      var setting = allResult.data.filter(function(s) {
        return s.key === key;
      })[0];
      
      if (!setting) {
        return { success: false, data: null, error: 'Setting não encontrada: ' + key };
      }
      
      return { success: true, data: setting, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function createSetting(key, value, description, category) {
    if (!key) return { success: false, data: null, error: 'Key é obrigatória.' };
    if (value === undefined || value === null) {
      return { success: false, data: null, error: 'Value é obrigatório.' };
    }
    
    try {
      // Verifica se já existe
      var existing = getSetting(key);
      if (existing.success) {
        return { success: false, data: null, error: 'Setting já existe. Use updateSetting para atualizar.' };
      }
      
      var setting = {
        SettingKey: key,
        SettingValue: String(value),
        Description: description || '',
        Category: category || 'General',
        Type: 'string',
        CreatedAt: Utils.getTimestamp(),
        UpdatedAt: Utils.getTimestamp(),
        UpdatedBy: 'system'
      };
      
      var result = Utils.addRow('Settings', setting);
      if (!result.success) return result;
      
      _syncToProperties(key, String(value));
      _invalidateCache(key);
      _audit('CREATE', key);
      
      return { success: true, data: { key: key, created: true }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function updateSetting(key, value, actorId) {
    if (!key) return { success: false, data: null, error: 'Key é obrigatória.' };
    if (value === undefined || value === null) {
      return { success: false, data: null, error: 'Value é obrigatório.' };
    }
    
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      
      var sheet = Utils.getSheet('Settings');
      if (!sheet) return { success: false, data: null, error: 'Aba Settings não encontrada.' };
      
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var keyCol = headers.indexOf('Key') !== -1 ? headers.indexOf('Key') : headers.indexOf('SettingKey');
      
      if (keyCol === -1) {
        return { success: false, data: null, error: 'Coluna Key não encontrada.' };
      }
      
      // Busca linha da setting
      var rowIndex = -1;
      for (var i = 1; i < values.length; i++) {
        if (values[i][keyCol] === key) {
          rowIndex = i;
          break;
        }
      }
      
      if (rowIndex === -1) {
        return { success: false, data: null, error: 'Setting não encontrada: ' + key };
      }
      
      // Atualiza valor
      var valueCol = headers.indexOf('Value') !== -1 ? headers.indexOf('Value') : headers.indexOf('SettingValue');
      if (valueCol !== -1) {
        values[rowIndex][valueCol] = String(value);
      }
      
      var updatedAtCol = headers.indexOf('UpdatedAt');
      if (updatedAtCol !== -1) {
        values[rowIndex][updatedAtCol] = Utils.getTimestamp();
      }
      
      var updatedByCol = headers.indexOf('UpdatedBy');
      if (updatedByCol !== -1) {
        values[rowIndex][updatedByCol] = actorId || 'system';
      }
      
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      
      _syncToProperties(key, String(value));
      _invalidateCache(key);
      _audit('UPDATE', key, actorId);
      
      return { success: true, data: { key: key, value: String(value), updated: true }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function deleteSetting(key, actorId) {
    if (!key) return { success: false, data: null, error: 'Key é obrigatória.' };
    
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      
      var sheet = Utils.getSheet('Settings');
      if (!sheet) return { success: false, data: null, error: 'Aba Settings não encontrada.' };
      
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var keyCol = headers.indexOf('Key') !== -1 ? headers.indexOf('Key') : headers.indexOf('SettingKey');
      
      if (keyCol === -1) {
        return { success: false, data: null, error: 'Coluna Key não encontrada.' };
      }
      
      // Busca e remove linha
      for (var i = values.length - 1; i >= 1; i--) {
        if (values[i][keyCol] === key) {
          sheet.deleteRow(i + 1);
          
          _invalidateCache(key);
          _audit('DELETE', key, actorId);
          
          return { success: true, data: { key: key, deleted: true }, error: null };
        }
      }
      
      return { success: false, data: null, error: 'Setting não encontrada: ' + key };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function exportSettings() {
    try {
      var allResult = getAllSettings();
      if (!allResult.success) return allResult;
      
      var exportData = {
        exportedAt: Utils.getTimestamp(),
        version: '1.0',
        settingsCount: allResult.data.length,
        settings: allResult.data
      };
      
      return { success: true, data: exportData, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function importSettings(data, actorId) {
    if (!data || !Array.isArray(data.settings)) {
      return { success: false, data: null, error: 'Dados de importação inválidos.' };
    }
    
    try {
      var imported = 0;
      var failed = 0;
      var errors = [];
      
      data.settings.forEach(function(setting) {
        var key = setting.key;
        var value = setting.value;
        
        // Verifica se existe
        var existing = getSetting(key);
        
        var result;
        if (existing.success) {
          // Atualiza existente
          result = updateSetting(key, value, actorId);
        } else {
          // Cria nova
          result = createSetting(key, value, setting.description, setting.category);
        }
        
        if (result.success) {
          imported++;
        } else {
          failed++;
          errors.push({ key: key, error: result.error });
        }
      });
      
      return {
        success: imported > 0,
        data: {
          imported: imported,
          failed: failed,
          total: data.settings.length,
          errors: errors
        },
        error: failed === data.settings.length ? 'Nenhuma setting foi importada.' : null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function resetToDefaults(actorId) {
    try {
      var reset = 0;
      var failed = 0;
      
      Object.keys(DEFAULT_SETTINGS).forEach(function(key) {
        var def = DEFAULT_SETTINGS[key];
        var existing = getSetting(key);
        
        var result;
        if (existing.success) {
          result = updateSetting(key, def.value, actorId);
        } else {
          result = createSetting(key, def.value, def.description, def.category);
        }
        
        if (result.success) {
          reset++;
        } else {
          failed++;
        }
      });
      
      _audit('RESET_DEFAULTS', 'ALL', actorId);
      
      return {
        success: reset > 0,
        data: {
          reset: reset,
          failed: failed,
          total: Object.keys(DEFAULT_SETTINGS).length
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getSettingsByCategory(category) {
    if (!category) return { success: false, data: null, error: 'Category é obrigatória.' };
    
    try {
      var allResult = getAllSettings();
      if (!allResult.success) return allResult;
      
      var filtered = allResult.data.filter(function(s) {
        return s.category === category;
      });
      
      return { success: true, data: filtered, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    getAllSettings: getAllSettings,
    getSetting: getSetting,
    createSetting: createSetting,
    updateSetting: updateSetting,
    deleteSetting: deleteSetting,
    exportSettings: exportSettings,
    importSettings: importSettings,
    resetToDefaults: resetToDefaults,
    getSettingsByCategory: getSettingsByCategory
  };
})();
