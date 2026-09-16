/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — MaintenanceService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Manutenção preventiva. Limpeza periódica: sessões expiradas, logs antigos, cache expirado e otimização da planilha.
 *
 * FUNCIONALIDADES:
 *   • cleanupExpiredSessions() — Remove sessões expiradas.
   • purgeOldLogs(days) — Remove logs antigos.
   • cleanExpiredCache() — Limpa cache expirado.
   • optimizeSheet() — Otimiza tamanho da planilha.
   • runFullMaintenance() — Executa todas as tarefas.
   • getMaintenanceReport() — Relatório da manutenção.
   • scheduleMaintenance() — Agenda próxima manutenção.
 *
 * INTEGRAÇÕES:
 *   • SessionService — limpeza de sessões.
   • LoggerService — purga de logs.
   • CacheService — limpeza de cache.
   • TriggerService — agendamento.
   • ConfigService — parâmetros de retenção.
 * Scheduled maintenance — execução periódica via triggers.
   Batch cleanup — operações consolidadas em lote.
   Reporting — relatório de cada execução.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — {{ success, data, error }}.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const MaintenanceService = (function () {
  var REPORT_KEY = 'LAST_MAINTENANCE_REPORT';
  function _ok(data) { return typeof ServiceResult !== 'undefined' ? ServiceResult.ok(data) : { success: true, data: data, error: null }; }
  function _fail(message, fallback) { return typeof ServiceResult !== 'undefined' ? ServiceResult.fail(message, fallback) : { success: false, data: fallback || null, error: message }; }
  function _remember(report) { try { if (typeof PropertiesService !== 'undefined') PropertiesService.getDocumentProperties().setProperty(REPORT_KEY, JSON.stringify(report)); } catch (err) {} }
  function cleanupExpiredSessions() {
    try {
      if (typeof SessionService !== 'undefined' && SessionService.cleanupExpiredSessions) return SessionService.cleanupExpiredSessions();
      return _fail('SessionService não disponível.', { removed: 0 });
    } catch (err) { return _fail(err, { removed: 0 }); }
  }
  function purgeOldLogs(days) {
    var retention = Math.max(1, parseInt(days, 10) || 90);
    try {
      if (typeof LoggerService !== 'undefined' && LoggerService.purgeOldLogs) return LoggerService.purgeOldLogs(retention);
      return _fail('LoggerService não disponível.', { removed: 0 });
    } catch (err) { return _fail(err, { removed: 0 }); }
  }
  function cleanExpiredCache() {
    try {
      if (typeof AppCacheService !== 'undefined' && AppCacheService.clear) return AppCacheService.clear();
      return _fail('AppCacheService não disponível.', 0);
    } catch (err) { return _fail(err, 0); }
  }
  function optimizeSheet() {
    try {
      if (typeof PropertiesService === 'undefined' || typeof SpreadsheetApp === 'undefined') return _fail('SpreadsheetApp não disponível.', null);
      var id = PropertiesService.getDocumentProperties().getProperty('SPREADSHEETS_ID');
      if (!id) return _fail('SPREADSHEETS_ID não configurado.', null);
      var spreadsheet = SpreadsheetApp.openById(id);
      var summary = spreadsheet.getSheets().map(function (sheet) { return { name: sheet.getName(), rows: sheet.getLastRow(), columns: sheet.getLastColumn() }; });
      return _ok({ sheets: summary, optimizedAt: new Date().toISOString(), mode: 'inventory-only' });
    } catch (err) { return _fail(err, null); }
  }
  function runFullMaintenance() {
    var startedAt = new Date().toISOString();
    var retention = typeof ConfigService !== 'undefined' && ConfigService.get ? ConfigService.get('LOG_RETENTION_DAYS') : 90;
    var report = { startedAt: startedAt, sessions: cleanupExpiredSessions(), logs: purgeOldLogs(retention), cache: cleanExpiredCache(), sheet: optimizeSheet() };
    report.finishedAt = new Date().toISOString(); report.success = [report.sessions, report.logs, report.cache, report.sheet].every(function (item) { return item && item.success; });
    _remember(report);
    try { if (typeof LoggerService !== 'undefined' && LoggerService.log) LoggerService.log('MAINTENANCE', 'system', { success: report.success, finishedAt: report.finishedAt }); } catch (err) {}
    return _ok(report);
  }
  function getMaintenanceReport() {
    try {
      var raw = typeof PropertiesService !== 'undefined' ? PropertiesService.getDocumentProperties().getProperty(REPORT_KEY) : null;
      return _ok(raw ? JSON.parse(raw) : { message: 'Nenhuma manutenção executada.', lastRun: null });
    } catch (err) { return _fail(err, null); }
  }
  function scheduleMaintenance() {
    try {
      if (typeof TriggerService !== 'undefined' && TriggerService.installDailyTrigger) return TriggerService.installDailyTrigger('maintenance_runFullMaintenance', 3);
      return _fail('TriggerService não disponível.');
    } catch (err) { return _fail(err); }
  }
  return { cleanupExpiredSessions: cleanupExpiredSessions, purgeOldLogs: purgeOldLogs, cleanExpiredCache: cleanExpiredCache, optimizeSheet: optimizeSheet, runFullMaintenance: runFullMaintenance, getMaintenanceReport: getMaintenanceReport, scheduleMaintenance: scheduleMaintenance };
})();

function maintenance_runFullMaintenance() {
  return MaintenanceService.runFullMaintenance();
}
