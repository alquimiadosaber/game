/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — SessionService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Serviço de gestão de sessões. Mantém registro de sessões ativas na aba
 *   Sessions. Sessões expiram conforme MAX_SESSION_DURATION (minutos).
 *
 * NOTA DE ARQUITETURA (desvio de assinatura, não de nome):
 *   O Google Apps Script não mantém cookies/sessão HTTP nativa entre
 *   chamadas de doGet(e) — cada carregamento de página é uma requisição
 *   nova e independente. Por isso getActiveSession() e getCurrentUser()
 *   (AuthService.gs) exigem explicitamente um TOKEN — normalmente lido de
 *   e.parameter.token na URL, ou passado diretamente pelo cliente numa
 *   chamada google.script.run. Sem token, não há "sessão corrente" possível
 *   neste ambiente. Isto é uma extensão da assinatura original do stub
 *   (que previa getActiveSession() sem argumentos), não uma renomeação.
 *
 * FUNCIONALIDADES:
 *   • createSession(userId, email) — Cria sessão com token único.
 *   • getActiveSession(token) — Retorna a sessão correspondente ao token.
 *   • deleteSession(sessionId) — Encerra sessão (soft delete: IsActive=false).
 *   • deleteAllUserSessions(userId) — Encerra todas as sessões do utilizador.
 *   • isSessionValid(sessionId) — Verifica validade.
 *   • cleanupExpiredSessions() — Marca sessões expiradas como inativas (batch).
 *   • countActiveSessions() — Conta sessões ativas e não expiradas.
 *
 * INTEGRAÇÕES:
 *   • Utils — leitura/escrita em lote na aba Sessions.
 *   • ConfigService — leitura de MAX_SESSION_DURATION (opcional/defensiva).
 *
 * COLUNA DA PLANILHA (Sessions):
 *   A: SessionID | B: UserID | C: Email | D: CreatedAt | E: ExpiresAt |
 *   F: IsActive | G: LastActivity
 *
 * DESIGN NOTE:
 *   Sem expiração deslizante (sliding expiration): LastActivity é gravado na
 *   criação e não é atualizado a cada leitura, para evitar uma escrita na
 *   planilha por requisição (ver regras de quota/performance em SKILL.md).
 *   A sessão tem TTL fixo a partir da criação (MAX_SESSION_DURATION).
 *
 * PADRÕES:
 *   Batch read/write — via Utils; cleanupExpiredSessions() reescreve a
 *   coluna IsActive inteira num único setValues().
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const SessionService = (function () {

  var DEFAULT_DURATION_MINUTES = 60;

  function _maxDurationMinutes() {
    try {
      if (typeof ConfigService !== 'undefined' && ConfigService.get) {
        var n = parseInt(ConfigService.get('MAX_SESSION_DURATION'), 10);
        if (!isNaN(n) && n > 0) return n;
      }
    } catch (err) {
      // Cai para o padrão local.
    }
    return DEFAULT_DURATION_MINUTES;
  }

  function _findSessionRow(sessionId) {
    var sheet = Utils.getSheet('Sessions');
    if (!sheet) return null;
    var values = sheet.getDataRange().getValues();
    var headers = values[0] || [];
    var index = {};
    headers.forEach(function (h, i) { index[h] = i; });
    var col = index.SessionID;
    if (col === undefined) return null;
    var wantedId = String(sessionId || '').trim();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][col] || '').trim() === wantedId) {
        return { rowNumber: i + 1, row: values[i], index: index, sheet: sheet };
      }
    }
    return null;
  }

  function _isActive(value) {
    if (value === true || value === 1) return true;
    if (typeof value !== 'string') return false;
    return ['true', '1', 'sim', 'ativo', 'active'].indexOf(value.trim().toLowerCase()) !== -1;
  }

  function _isExpired(expiresAtIso) {
    var timestamp = new Date(expiresAtIso).getTime();
    // Data ausente/corrompida deve bloquear o acesso, nunca prolongá-lo.
    return !isFinite(timestamp) || timestamp <= Date.now();
  }

  function createSession(userId, email) {
    try {
      userId = String(userId || '').trim();
      email = String(email || '').trim().toLowerCase();
      if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
      if (!email) return { success: false, data: null, error: 'E-mail é obrigatório.' };

      var token = Utils.generateId();
      var createdAt = Utils.getTimestamp();
      var expiresAt = new Date(Date.now() + _maxDurationMinutes() * 60000).toISOString();
      var result = Utils.addRow('Sessions', {
        SessionID: token,
        UserID: userId,
        Email: email,
        CreatedAt: createdAt,
        ExpiresAt: expiresAt,
        IsActive: true,
        LastActivity: createdAt
      });
      if (!result.success) return result;
      return { success: true, data: { token: token, expiresAt: expiresAt }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getActiveSession(token) {
    try {
      token = String(token || '').trim();
      if (!token) return { success: false, data: null, error: 'Token não informado.' };
      var match = _findSessionRow(token);
      if (!match) return { success: false, data: null, error: 'Sessão não encontrada.' };
      var row = match.row, index = match.index;
      if (index.UserID === undefined || index.IsActive === undefined || index.ExpiresAt === undefined) {
        return { success: false, data: null, error: 'Cabeçalho da aba Sessions inválido.' };
      }
      if (!_isActive(row[index.IsActive])) return { success: false, data: null, error: 'Sessão encerrada.' };
      if (_isExpired(row[index.ExpiresAt])) {
        deleteSession(token); // limpeza best-effort; não bloqueia a resposta se falhar
        return { success: false, data: null, error: 'Sessão expirada.' };
      }
      return {
        success: true,
        data: { sessionId: token, userId: row[index.UserID], email: row[index.Email] },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function deleteSession(sessionId) {
    sessionId = String(sessionId || '').trim();
    if (!sessionId) return { success: false, data: null, error: 'Token não informado.' };
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var match = _findSessionRow(sessionId);
      if (!match) return { success: false, data: null, error: 'Sessão não encontrada.' };
      match.sheet.getRange(match.rowNumber, match.index.IsActive + 1).setValue(false);
      return { success: true, data: { sessionId: sessionId }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function deleteAllUserSessions(userId) {
    userId = String(userId || '').trim();
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('Sessions');
      if (!sheet) return { success: false, data: null, error: 'Aba Sessions não encontrada.' };
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var userCol = headers.indexOf('UserID');
      var activeCol = headers.indexOf('IsActive');
      if (userCol === -1 || activeCol === -1) return { success: false, data: null, error: 'Cabeçalho da aba Sessions inválido.' };
      var closed = 0;
      for (var i = 1; i < values.length; i++) {
        if (String(values[i][userCol] || '').trim() === userId && _isActive(values[i][activeCol])) {
          values[i][activeCol] = false;
          closed++;
        }
      }
      if (closed > 0) sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      return { success: true, data: { closed: closed }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function isSessionValid(sessionId) {
    var result = getActiveSession(sessionId);
    return { success: true, data: !!result.success, error: null };
  }

  function cleanupExpiredSessions() {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('Sessions');
      if (!sheet) return { success: false, data: null, error: 'Aba Sessions não encontrada.' };
      var values = sheet.getDataRange().getValues();
      if (values.length < 2) return { success: true, data: 0, error: null };
      var headers = values[0];
      var expiresCol = headers.indexOf('ExpiresAt');
      var activeCol = headers.indexOf('IsActive');
      if (expiresCol === -1 || activeCol === -1) return { success: false, data: null, error: 'Cabeçalho da aba Sessions inválido.' };
      var cleaned = 0;
      for (var i = 1; i < values.length; i++) {
        if (_isActive(values[i][activeCol]) && _isExpired(values[i][expiresCol])) {
          values[i][activeCol] = false;
          cleaned++;
        }
      }
      if (cleaned > 0) sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      return { success: true, data: cleaned, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function countActiveSessions() {
    var result = Utils.getAllRows('Sessions');
    if (!result.success) return result;
    var count = result.data.filter(function (row) {
      return _isActive(row.IsActive) && !_isExpired(row.ExpiresAt);
    }).length;
    return { success: true, data: count, error: null };
  }

  return {
    createSession: createSession,
    getActiveSession: getActiveSession,
    deleteSession: deleteSession,
    deleteAllUserSessions: deleteAllUserSessions,
    isSessionValid: isSessionValid,
    cleanupExpiredSessions: cleanupExpiredSessions,
    countActiveSessions: countActiveSessions
  };
})();
