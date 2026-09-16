/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — ScoreRankingService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Rankings e leaderboards. Gera rankings globais e por turma, calcula percentis e fornece dados de gamificação.
 *
 * FUNCIONALIDADES:
 *   • getGlobalRanking(limit) — Ranking global.
   • getClassroomRanking(classId, limit) — Ranking por turma.
   • getUserPercentile(userId) — Percentil do utilizador.
   • getTopScorers(limit) — Top pontuadores.
   • getUserRank(userId) — Posição no ranking.
   • getLeaderboardData() — Dados para leaderboard.
 *
 * INTEGRAÇÕES:
 *   • SpreadsheetApp — aba Scores.
   • UserController — dados dos utilizadores.
   • GamificationService — badges e conquistas.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — {{ success, data, error }}.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ScoreRankingService = (function () {
  function _ok(data) { return typeof ServiceResult !== 'undefined' ? ServiceResult.ok(data) : { success: true, data: data, error: null }; }
  function _fail(message, fallback) { return typeof ServiceResult !== 'undefined' ? ServiceResult.fail(message, fallback) : { success: false, data: fallback || null, error: message }; }
  function _limit(value) { var n = parseInt(value, 10); return isFinite(n) ? Math.max(1, Math.min(100, n)) : 20; }
  function _scores() {
    if (typeof Utils === 'undefined' || !Utils.getAllRows) return _fail('Utils não disponível.', []);
    return Utils.getAllRows('Scores');
  }
  function _aggregate(rows) {
    var byUser = {};
    (rows || []).forEach(function (row) {
      var userId = String(row.UserID || row.UserId || '').trim();
      if (!userId) return;
      if (!byUser[userId]) byUser[userId] = { userId: userId, totalScore: 0, attempts: 0, xp: 0 };
      byUser[userId].totalScore += Number(row.Score || row.FinalScore || 0) || 0;
      byUser[userId].xp += Number(row.XP || 0) || 0;
      byUser[userId].attempts += 1;
    });
    return Object.keys(byUser).map(function (key) {
      var item = byUser[key];
      item.averageScore = item.attempts ? Math.round((item.totalScore / item.attempts) * 100) / 100 : 0;
      return item;
    }).sort(function (a, b) { return b.totalScore - a.totalScore || b.averageScore - a.averageScore || a.userId.localeCompare(b.userId); }).map(function (item, index) {
      item.rank = index + 1;
      return item;
    });
  }
  function getGlobalRanking(limit) {
    var scores = _scores();
    if (!scores.success) return _fail(scores.error, []);
    return _ok(_aggregate(scores.data).slice(0, _limit(limit)));
  }
  function getClassroomRanking(classId, limit) {
    if (!classId) return _fail('Turma é obrigatória.', []);
    var scores = _scores();
    if (!scores.success) return _fail(scores.error, []);
    var users = typeof UserController !== 'undefined' && UserController.getAllUsers ? UserController.getAllUsers() : _ok([]);
    if (!users.success) return _fail(users.error, []);
    var allowed = {};
    users.data.forEach(function (user) {
      var classroom = user.ClassID || user.Classroom || user.Turma;
      if (String(classroom || '') === String(classId)) allowed[String(user.UserID || user.UserId)] = true;
    });
    var rows = scores.data.filter(function (row) { return allowed[String(row.UserID || row.UserId)]; });
    return _ok(_aggregate(rows).slice(0, _limit(limit)));
  }
  function getUserPercentile(userId) {
    var ranking = getGlobalRanking(100);
    if (!ranking.success) return ranking;
    var entry = ranking.data.filter(function (item) { return item.userId === String(userId); })[0];
    if (!entry) return _fail('Utilizador sem pontuações.', null);
    var count = ranking.data.length;
    var percentile = count <= 1 ? 100 : Math.round(((count - entry.rank) / (count - 1)) * 10000) / 100;
    return _ok({ userId: entry.userId, rank: entry.rank, percentile: percentile, totalUsers: count });
  }
  function getTopScorers(limit) { return getGlobalRanking(limit || 10); }
  function getUserRank(userId) {
    var percentile = getUserPercentile(userId);
    return percentile.success ? _ok({ rank: percentile.data.rank, totalUsers: percentile.data.totalUsers }) : percentile;
  }
  function getLeaderboardData() {
    var ranking = getGlobalRanking(20);
    if (!ranking.success) return ranking;
    return _ok({ ranking: ranking.data, generatedAt: new Date().toISOString(), totalUsers: ranking.data.length });
  }
  // Nomes por userId, para a vizinhanca nao exibir um identificador cru ao
  // estudante. Se UserController nao responder, cai no proprio id.
  function _names() {
    var mapa = {};
    if (typeof UserController === 'undefined' || !UserController.getAllUsers) return mapa;
    var users = UserController.getAllUsers();
    if (!users || !users.success) return mapa;
    (users.data || []).forEach(function (user) {
      var id = String(user.UserID || user.UserId || '');
      if (id) mapa[id] = user.FullName || user.Name || user.Nome || user.Email || id;
    });
    return mapa;
  }
  /**
   * Janela do ranking em volta do estudante: ate 2 com pontuacao maior ou
   * igual e ate 2 com menor ou igual. Usa o total acumulado, que e o mesmo
   * criterio do ranking global — trocar de criterio entre as duas telas faria
   * a posicao parecer inconsistente.
   */
  function getVizinhanca(userId) {
    var scores = _scores();
    if (!scores.success) return _fail(scores.error, null);
    var nomes = _names();
    var entradas = _aggregate(scores.data).map(function (item) {
      return { id: item.userId, nome: nomes[item.userId] || item.userId, pontuacao: item.totalScore };
    });
    return _ok(rankingVizinhanca(entradas, String(userId)));
  }
  return { getGlobalRanking: getGlobalRanking, getClassroomRanking: getClassroomRanking, getUserPercentile: getUserPercentile, getTopScorers: getTopScorers, getUserRank: getUserRank, getLeaderboardData: getLeaderboardData, getVizinhanca: getVizinhanca };
})();
