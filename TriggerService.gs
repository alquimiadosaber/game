/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — TriggerService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Gestão de gatilhos temporais (triggers) do Google Apps Script. Configura
 *   execuções automáticas para manutenção periódica, limpeza de dados e
 *   relatórios programados respeitando a quota de 90 minutos/dia.
 *
 * FUNCIONALIDADES:
 *   • installDailyTrigger(functionName, hour) — Instala gatilho diário.
 *   • installWeeklyTrigger(functionName, day, hour) — Instala gatilho semanal.
 *   • getAllTriggers() — Lista todos os gatilhos ativos.
 *   • removeTrigger(triggerId) — Remove gatilho específico.
 *   • removeAllTriggers() — Remove todos os gatilhos do projeto.
 *   • cleanupExpiredSessions() — Handler de limpeza de sessões (chamado por trigger).
 *   • pruneOldLogs() — Handler de limpeza de logs (chamado por trigger).
 *   • generateDailyReport() — Handler de relatório diário (chamado por trigger).
 *   • getQuotaUsage() — Consulta uso de quota de triggers.
 *
 * HANDLERS AUTOMÁTICOS (chamados pelos triggers):
 *   Estas funções são referenciadas por nome (string) nos triggers e executadas
 *   automaticamente pelo Google Apps Script:
 *   - cleanupExpiredSessions() → limpa sessões expiradas
 *   - pruneOldLogs() → remove logs antigos (>90 dias)
 *   - generateDailyReport() → gera relatórios de uso
 *
 * INTEGRAÇÕES:
 *   • ScriptApp.newTrigger() — API nativa de triggers do GAS.
 *   • SessionService — limpeza de sessões expiradas.
 *   • LoggerService — limpeza de logs antigos.
 *   • ReportService — geração de relatórios automáticos.
 *   • ConfigService — configurações de frequência e horários.
 *
 * QUOTA MANAGEMENT:
 *   Google Apps Script limita execução de triggers a 90 minutos/dia (total).
 *   Este serviço implementa gestão básica para evitar estouro de quota:
 *   - Triggers idempotentes (podem executar múltiplas vezes sem efeitos colaterais)
 *   - Execuções curtas (< 5 minutos cada)
 *   - Máximo recomendado: 18 triggers/dia (90min ÷ 5min = 18)
 *
 * PADRÕES:
 *   Time-driven triggers — execução em horários específicos.
 *   Idempotent operations — handlers seguros para re-execução.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const TriggerService = (function () {

  var MAX_TRIGGERS = 20; // Limite de segurança (GAS permite até 20 triggers por projeto)
  var LOG_RETENTION_DAYS = 90; // Retenção de logs (padrão)

  function _audit(action, details) {
    try {
      if (typeof LoggerService !== 'undefined' && LoggerService.log) {
        LoggerService.log('TRIGGER', action, details);
      }
    } catch (err) {
      // Auditoria é auxiliar.
    }
  }

  function installDailyTrigger(functionName, hour) {
    if (!functionName) {
      return { success: false, data: null, error: 'Nome da função é obrigatório.' };
    }
    
    try {
      var hourVal = parseInt(hour, 10);
      if (isNaN(hourVal) || hourVal < 0 || hourVal > 23) {
        hourVal = 3; // Padrão: 3h da manhã
      }
      
      // Verifica limite de triggers
      var existing = ScriptApp.getProjectTriggers();
      if (existing.length >= MAX_TRIGGERS) {
        return { success: false, data: null, error: 'Limite de triggers atingido (' + MAX_TRIGGERS + ').' };
      }
      
      // Cria trigger diário
      var trigger = ScriptApp.newTrigger(functionName)
        .timeBased()
        .atHour(hourVal)
        .everyDays(1)
        .create();
      
      _audit('TRIGGER_INSTALLED', 'Daily: ' + functionName + ' at ' + hourVal + 'h');
      
      return {
        success: true,
        data: {
          triggerId: trigger.getUniqueId(),
          functionName: functionName,
          type: 'daily',
          hour: hourVal
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function installWeeklyTrigger(functionName, dayOfWeek, hour) {
    if (!functionName) {
      return { success: false, data: null, error: 'Nome da função é obrigatório.' };
    }
    
    try {
      var hourVal = parseInt(hour, 10);
      if (isNaN(hourVal) || hourVal < 0 || hourVal > 23) {
        hourVal = 3; // Padrão: 3h da manhã
      }
      
      // Converte dia da semana (string ou número)
      var dayMap = {
        'sunday': ScriptApp.WeekDay.SUNDAY,
        'monday': ScriptApp.WeekDay.MONDAY,
        'tuesday': ScriptApp.WeekDay.TUESDAY,
        'wednesday': ScriptApp.WeekDay.WEDNESDAY,
        'thursday': ScriptApp.WeekDay.THURSDAY,
        'friday': ScriptApp.WeekDay.FRIDAY,
        'saturday': ScriptApp.WeekDay.SATURDAY,
        '0': ScriptApp.WeekDay.SUNDAY,
        '1': ScriptApp.WeekDay.MONDAY,
        '2': ScriptApp.WeekDay.TUESDAY,
        '3': ScriptApp.WeekDay.WEDNESDAY,
        '4': ScriptApp.WeekDay.THURSDAY,
        '5': ScriptApp.WeekDay.FRIDAY,
        '6': ScriptApp.WeekDay.SATURDAY
      };
      
      var day = dayMap[String(dayOfWeek).toLowerCase()] || ScriptApp.WeekDay.MONDAY;
      
      // Verifica limite de triggers
      var existing = ScriptApp.getProjectTriggers();
      if (existing.length >= MAX_TRIGGERS) {
        return { success: false, data: null, error: 'Limite de triggers atingido (' + MAX_TRIGGERS + ').' };
      }
      
      // Cria trigger semanal
      var trigger = ScriptApp.newTrigger(functionName)
        .timeBased()
        .onWeekDay(day)
        .atHour(hourVal)
        .create();
      
      _audit('TRIGGER_INSTALLED', 'Weekly: ' + functionName + ' on ' + dayOfWeek + ' at ' + hourVal + 'h');
      
      return {
        success: true,
        data: {
          triggerId: trigger.getUniqueId(),
          functionName: functionName,
          type: 'weekly',
          dayOfWeek: dayOfWeek,
          hour: hourVal
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getAllTriggers() {
    try {
      var triggers = ScriptApp.getProjectTriggers();
      
      var list = triggers.map(function(trigger) {
        var eventType = trigger.getEventType();
        var handlerFunction = trigger.getHandlerFunction();
        
        return {
          triggerId: trigger.getUniqueId(),
          handlerFunction: handlerFunction,
          eventType: String(eventType),
          enabled: true // GAS não tem conceito de trigger desabilitado (só existe ou não existe)
        };
      });
      
      return { success: true, data: list, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function removeTrigger(triggerId) {
    if (!triggerId) {
      return { success: false, data: null, error: 'Trigger ID é obrigatório.' };
    }
    
    try {
      var triggers = ScriptApp.getProjectTriggers();
      var found = false;
      
      for (var i = 0; i < triggers.length; i++) {
        if (triggers[i].getUniqueId() === triggerId) {
          ScriptApp.deleteTrigger(triggers[i]);
          found = true;
          _audit('TRIGGER_REMOVED', triggerId);
          break;
        }
      }
      
      if (!found) {
        return { success: false, data: null, error: 'Trigger não encontrado.' };
      }
      
      return { success: true, data: { triggerId: triggerId }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function removeAllTriggers() {
    try {
      var triggers = ScriptApp.getProjectTriggers();
      var removed = 0;
      
      triggers.forEach(function(trigger) {
        ScriptApp.deleteTrigger(trigger);
        removed++;
      });
      
      _audit('TRIGGER_REMOVED_ALL', 'Removed ' + removed + ' triggers');
      
      return { success: true, data: { removed: removed }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getQuotaUsage() {
    try {
      // GAS não fornece API direta para consultar quota de triggers.
      // Retorna informações básicas e estimativa.
      var triggers = ScriptApp.getProjectTriggers();
      
      var estimatedMinutesPerDay = triggers.length * 5; // Estimativa: 5min por execução
      var quotaPercentage = (estimatedMinutesPerDay / 90) * 100;
      
      return {
        success: true,
        data: {
          activeTriggers: triggers.length,
          maxTriggers: MAX_TRIGGERS,
          estimatedDailyMinutes: estimatedMinutesPerDay,
          dailyQuotaMinutes: 90,
          quotaUsagePercentage: Math.round(quotaPercentage),
          warning: quotaPercentage > 80 ? 'Quota de triggers próxima do limite!' : null
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HANDLERS AUTOMÁTICOS (chamados pelos triggers)
  // Estas funções devem ser exportadas como funções TOP-LEVEL para que o
  // Google Apps Script possa invocá-las via trigger.
  // ─────────────────────────────────────────────────────────────────────────

  function cleanupExpiredSessions() {
    try {
      if (typeof SessionService === 'undefined') {
        return { success: false, data: null, error: 'SessionService não disponível.' };
      }
      
      // Busca e remove sessões expiradas
      var lock = LockService.getScriptLock();
      lock.waitLock(30000);
      
      var sheet = Utils.getSheet('Sessions');
      if (!sheet) {
        lock.releaseLock();
        return { success: false, data: null, error: 'Aba Sessions não encontrada.' };
      }
      
      var values = sheet.getDataRange().getValues();
      if (values.length < 2) {
        lock.releaseLock();
        return { success: true, data: { removed: 0 }, error: null };
      }
      
      var headers = values[0];
      var expiresAtCol = headers.indexOf('ExpiresAt');
      
      if (expiresAtCol === -1) {
        lock.releaseLock();
        return { success: false, data: null, error: 'Coluna ExpiresAt não encontrada.' };
      }
      
      var now = new Date();
      var removed = 0;
      
      // Remove de trás para frente
      for (var i = values.length - 1; i >= 1; i--) {
        var expiresAt = new Date(values[i][expiresAtCol]);
        if (expiresAt < now) {
          sheet.deleteRow(i + 1);
          removed++;
        }
      }
      
      lock.releaseLock();
      _audit('CLEANUP_SESSIONS', 'Removed ' + removed + ' expired sessions');
      
      return { success: true, data: { removed: removed }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function pruneOldLogs() {
    try {
      if (typeof LoggerService === 'undefined') {
        return { success: false, data: null, error: 'LoggerService não disponível.' };
      }
      
      var retentionDays = LOG_RETENTION_DAYS;
      
      // Tenta ler configuração customizada
      try {
        if (typeof ConfigService !== 'undefined') {
          var configValue = ConfigService.get('LOG_RETENTION_DAYS');
          if (configValue) {
            retentionDays = parseInt(configValue, 10) || LOG_RETENTION_DAYS;
          }
        }
      } catch (err) {
        // Usa padrão
      }
      
      var result = LoggerService.purgeOldLogs(retentionDays);
      
      if (result.success) {
        _audit('CLEANUP_LOGS', 'Purged logs older than ' + retentionDays + ' days');
      }
      
      return result;
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function generateDailyReport() {
    try {
      if (typeof ReportService === 'undefined' || typeof AnalyticsService === 'undefined') {
        return { success: false, data: null, error: 'Serviços de relatório não disponíveis.' };
      }
      
      // Gera estatísticas do sistema
      var stats = AnalyticsService.getSystemStatistics();
      
      if (!stats.success) return stats;
      
      // Log do relatório (pode ser expandido para envio por email)
      _audit('DAILY_REPORT', JSON.stringify(stats.data));
      
      return { success: true, data: stats.data, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    installDailyTrigger: installDailyTrigger,
    installWeeklyTrigger: installWeeklyTrigger,
    getAllTriggers: getAllTriggers,
    removeTrigger: removeTrigger,
    removeAllTriggers: removeAllTriggers,
    getQuotaUsage: getQuotaUsage,
    cleanupExpiredSessions: cleanupExpiredSessions,
    pruneOldLogs: pruneOldLogs,
    generateDailyReport: generateDailyReport
  };
})();

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTAÇÃO DE HANDLERS COMO FUNÇÕES TOP-LEVEL
// Google Apps Script só consegue invocar triggers em funções top-level,
// nunca em métodos de objetos IIFE. Estes wrappers delegam para TriggerService.
// ═══════════════════════════════════════════════════════════════════════════

function trigger_cleanupExpiredSessions() {
  return TriggerService.cleanupExpiredSessions();
}

function trigger_pruneOldLogs() {
  return TriggerService.pruneOldLogs();
}

function trigger_generateDailyReport() {
  return TriggerService.generateDailyReport();
}
