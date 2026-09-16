/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — LoggerService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Serviço de auditoria e logging. Registra todas as operações CRUD, eventos
 *   de autenticação, erros e ações administrativas na aba Logs.
 *
 * FUNCIONALIDADES:
 *   • log(eventType, actor, details) — Regista evento genérico na aba Logs.
 *   • getLogs(filters) — Consulta logs com filtros (eventType, actor, entity,
 *     severity, dateFrom, dateTo, limit).
 *   • purgeOldLogs(days) — Remove logs mais antigos que N dias.
 *   • logAuth(userId, action, ip) — Regista eventos de autenticação.
 *   • logCRUD(entity, action, entityId, userId) — Regista operações CRUD.
 *   • logError(module, error, context) — Regista erros do sistema.
 *
 * INTEGRAÇÕES:
 *   • Utils — escrita em lote (addRow/getAllRows) na aba Logs.
 *   • LockService — usado indiretamente via Utils.addRow / operações em lote.
 *
 * COLUNA DA PLANILHA (Logs):
 *   A: LogID | B: Timestamp | C: EventType | D: Actor | E: Entity | F: Action |
 *   G: Details | H: IPAddress | I: Severity
 *
 * PRIVACIDADE (público adolescente — ver SKILL.md):
 *   Details nunca deve conter texto livre integral de respostas dos alunos —
 *   apenas metadados estruturados. Chaves sensíveis comuns (password, token,
 *   salt, etc.) são automaticamente redigidas antes da escrita.
 *
 * PADRÕES:
 *   Batch read/write — via Utils.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const LoggerService = (function () {

  var SENSITIVE_KEYS = ['password', 'senha', 'token', 'apikey', 'passwordhash', 'salt', 'passwordsalt'];

  function _redact(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    var clone = Utils.deepCopy(obj);
    Object.keys(clone).forEach(function (key) {
      if (SENSITIVE_KEYS.indexOf(key.toLowerCase()) !== -1) {
        clone[key] = '***';
      }
    });
    return clone;
  }

  function _serializeDetails(details) {
    if (details === undefined || details === null) return '';
    if (typeof details === 'string') return details;
    try {
      return JSON.stringify(_redact(details));
    } catch (err) {
      return String(details);
    }
  }

  function _writeLog(fields) {
    var row = {
      LogID: Utils.generateId(),
      Timestamp: Utils.getTimestamp(),
      EventType: fields.eventType || '',
      Actor: fields.actor || 'system',
      Entity: fields.entity || '',
      Action: fields.action || '',
      Details: _serializeDetails(fields.details),
      IPAddress: fields.ipAddress || '',
      Severity: fields.severity || 'INFO'
    };
    return Utils.addRow('Logs', row);
  }

  function log(eventType, actor, details) {
    return _writeLog({ eventType: eventType, actor: actor, details: details, severity: 'INFO' });
  }

  function logAuth(userId, action, ip) {
    return _writeLog({ eventType: 'AUTH', actor: userId, entity: 'Session', action: action, ipAddress: ip, severity: 'INFO' });
  }

  function logCRUD(entity, action, entityId, userId) {
    return _writeLog({ eventType: 'CRUD', actor: userId, entity: entity, action: action, details: { entityId: entityId }, severity: 'INFO' });
  }

  function logError(module, error, context) {
    var message = error && error.message ? error.message : String(error);
    var stack = error && error.stack ? error.stack : '';
    return _writeLog({
      eventType: 'ERROR',
      actor: 'system',
      entity: module,
      action: 'EXCEPTION',
      details: { message: message, stack: stack, context: context },
      severity: 'ERROR'
    });
  }

  function getLogs(filters) {
    filters = filters || {};
    var result = Utils.getAllRows('Logs');
    if (!result.success) return result;
    var rows = result.data;
    if (filters.eventType) rows = rows.filter(function (r) { return r.EventType === filters.eventType; });
    if (filters.actor) rows = rows.filter(function (r) { return r.Actor === filters.actor; });
    if (filters.entity) rows = rows.filter(function (r) { return r.Entity === filters.entity; });
    if (filters.severity) rows = rows.filter(function (r) { return r.Severity === filters.severity; });
    if (filters.dateFrom) rows = rows.filter(function (r) { return new Date(r.Timestamp) >= new Date(filters.dateFrom); });
    if (filters.dateTo) rows = rows.filter(function (r) { return new Date(r.Timestamp) <= new Date(filters.dateTo); });
    rows.sort(function (a, b) { return new Date(b.Timestamp) - new Date(a.Timestamp); });
    if (filters.limit) rows = rows.slice(0, filters.limit);
    return { success: true, data: rows, error: null };
  }

  function purgeOldLogs(days) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('Logs');
      if (!sheet) return { success: false, data: null, error: 'Aba Logs não encontrada.' };
      var values = sheet.getDataRange().getValues();
      if (values.length < 2) return { success: true, data: 0, error: null };
      var headers = values[0];
      var tsCol = headers.indexOf('Timestamp');
      var cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - (days || 90));
      var kept = [headers];
      var removed = 0;
      for (var i = 1; i < values.length; i++) {
        var ts = new Date(values[i][tsCol]);
        if (ts >= cutoff) {
          kept.push(values[i]);
        } else {
          removed++;
        }
      }
      sheet.clearContents();
      sheet.getRange(1, 1, kept.length, headers.length).setValues(kept);
      return { success: true, data: removed, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  return {
    log: log,
    getLogs: getLogs,
    purgeOldLogs: purgeOldLogs,
    logAuth: logAuth,
    logCRUD: logCRUD,
    logError: logError
  };
})();
