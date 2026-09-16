/*
 * ALQUIMIA DO SABER — FlowService.gs
 * Orquestra o percurso autenticado: cenário → poção → resultado.
 * A identidade é sempre derivada do token da sessão; o cliente nunca escolhe
 * o UserID que será usado nas leituras ou escritas.
 */

const FlowService = (function () {
  var DIMENSIONS = ['IA', 'FIL', 'PSI', 'NEU', 'BIO', 'FIS', 'SOC', 'ART'];

  function _ok(data) {
    return { success: true, data: data === undefined ? null : data, error: null };
  }

  function _fail(message, fallback) {
    return { success: false, data: fallback === undefined ? null : fallback, error: String(message || 'Erro interno.') };
  }

  function _session(token) {
    if (!token) return _fail('Sessão não informada. Entre novamente.');
    var result = SessionService.getActiveSession(token);
    return result && result.success ? result : _fail((result && result.error) || 'Sessão inválida. Entre novamente.');
  }

  function _activeScenario(scenarioId) {
    if (!scenarioId) return _fail('Cenário não informado.');
    var result = ScenarioController.getScenarioById(scenarioId);
    if (!result.success) return result;
    if (String(result.data.Status || 'active').toLowerCase() !== 'active') {
      return _fail('Este cenário não está disponível.');
    }
    return result;
  }

  function _completedMap(userId) {
    var result = InteractionController.getInteractionsByUser(userId);
    var completed = {};
    if (result.success) {
      result.data.forEach(function (row) {
        completed[String(row.ScenarioID)] = true;
      });
    }
    return completed;
  }

  function _scenarioView(row, completed) {
    return {
      id: row.ScenarioID,
      title: row.Title || 'Cenário sem título',
      description: row.Description || row.Narrative || '',
      narrative: row.Narrative || row.Description || '',
      category: row.Category || 'geral',
      difficulty: row.Difficulty || 'medium',
      criteria: row.Criteria || row.EvaluationCriteria || '',
      completed: !!completed
    };
  }

  function getScenarios(token) {
    try {
      var session = _session(token);
      if (!session.success) return session;
      var result = ScenarioController.getAllScenarios();
      if (!result.success) return result;
      var completed = _completedMap(session.data.userId);
      var scenarios = result.data
        .filter(function (row) { return String(row.Status || 'active').toLowerCase() === 'active'; })
        .map(function (row) { return _scenarioView(row, completed[String(row.ScenarioID)]); });
      return _ok({
        user: { userId: session.data.userId, email: session.data.email },
        scenarios: scenarios,
        completed: Object.keys(completed).length,
        total: scenarios.length
      });
    } catch (err) {
      return _fail(err.message, { scenarios: [], completed: 0, total: 0 });
    }
  }

  function getWelcome(token) {
    try {
      var session = _session(token);
      if (!session.success) return session;
      var scenarioResult = getScenarios(token);
      if (!scenarioResult.success) return scenarioResult;
      var data = scenarioResult.data;
      var completed = Number(data.completed || 0);
      var level = Math.max(1, Math.floor(completed / 3) + 1);
      var result = getResultDashboard(token);
      var email = String(session.data.email || '');
      return _ok({
        fullName: session.data.fullName || session.data.name || email.split('@')[0] || 'Alquimista',
        level: level,
        xp: completed * 100,
        xpToNextLevel: level * 300,
        scenariosCompleted: completed,
        scenariosTotal: Number(data.total || 0),
        nextScenario: data.scenarios.filter(function (scenario) { return !scenario.completed; })[0] || null,
        lastResult: result.success ? {
          title: result.data.recommended.title,
          formula: result.data.recommended.formula,
          confidence: result.data.confidence
        } : null
      });
    } catch (err) {
      return _fail(err.message);
    }
  }

  function getScenario(token, scenarioId) {
    try {
      var session = _session(token);
      if (!session.success) return session;
      var scenario = _activeScenario(scenarioId);
      if (!scenario.success) return scenario;
      var attempts = InteractionController.getInteractionsByUser(session.data.userId);
      var rows = attempts.success ? attempts.data.filter(function (row) {
        return String(row.ScenarioID) === String(scenarioId);
      }) : [];
      rows.sort(function (a, b) {
        return new Date(b.CreatedAt || 0).getTime() - new Date(a.CreatedAt || 0).getTime();
      });
      return _ok({ scenario: _scenarioView(scenario.data, rows.length > 0), attempts: rows });
    } catch (err) {
      return _fail(err.message);
    }
  }

  function previewPotion(token, scenarioId, mixture) {
    try {
      var session = _session(token);
      if (!session.success) return session;
      var scenario = _activeScenario(scenarioId);
      if (!scenario.success) return scenario;
      mixture = mixture || {};
      var validation = InteractionService.validatePotion(mixture.fil, mixture.psi, mixture.ia);
      if (!validation.success) return validation;
      var reaction = CauldronService.calculateReaction(mixture.fil, mixture.psi, mixture.ia);
      if (!reaction.success) return reaction;
      var feedback = InteractionService.generatePotionFeedback(mixture.fil, mixture.psi, mixture.ia);
      return _ok({ reaction: reaction.data, feedback: feedback.success ? feedback.data : null });
    } catch (err) {
      return _fail(err.message);
    }
  }

  function submitPotion(token, scenarioId, mixture) {
    try {
      var session = _session(token);
      if (!session.success) return session;
      var scenario = _activeScenario(scenarioId);
      if (!scenario.success) return scenario;
      mixture = mixture || {};
      var validation = InteractionService.validatePotion(mixture.fil, mixture.psi, mixture.ia);
      if (!validation.success) return validation;
      var freeText = String(mixture.freeText || '').trim();
      if (!freeText) return _fail('Explique em texto como você resolveria o cenário.');

      // ✅ CORREÇÃO 1: Gerar chave de idempotência ANTES de qualquer mutação
      var attemptId = mixture.attemptId || (typeof Utils.generateId === 'function' ? Utils.generateId() : String(new Date().getTime()));
      
      // ✅ CORREÇÃO 2: Verificar se esta tentativa já foi processada (idempotência)
      var existingAttempt = InteractionController.getInteractionById(attemptId);
      if (existingAttempt.success && existingAttempt.data) {
        // Tentativa já existe — retornar resultado existente sem duplicar efeitos
        var existingScore = ScoreController.getScoresByUser(session.data.userId);
        var matchingScore = existingScore.success && existingScore.data ? 
          existingScore.data.filter(function(s) { return String(s.InteractionID) === String(attemptId); })[0] : null;
        
        var dashboard = getResultDashboard(token);
        return _ok({
          interactionId: attemptId,
          scenarioId: scenarioId,
          existingAttempt: true,
          score: matchingScore || null,
          dashboard: dashboard.success ? dashboard.data : null
        });
      }

      var initialized = CauldronService.initializeCauldron(session.data.userId, scenarioId);
      if (!initialized.success) return initialized;
      var ingredients = [
        ['FIL', validation.data.fil],
        ['PSI', validation.data.psi],
        ['IA', validation.data.ia]
      ];
      for (var i = 0; i < ingredients.length; i++) {
        var added = CauldronService.addIngredient(session.data.userId, ingredients[i][0], ingredients[i][1]);
        if (!added.success) return added;
      }

      var processed = InteractionService.processPotion({
        userId: session.data.userId,
        scenarioId: scenarioId,
        fil: validation.data.fil,
        psi: validation.data.psi,
        ia: validation.data.ia,
        freeText: freeText,
        difficulty: scenario.data.Difficulty || 'medium'
      });
      if (!processed.success) return processed;

      // ✅ CORREÇÃO 3: Usar attemptId como InteractionID para garantir idempotência
      var interaction = InteractionController.createInteraction({
        interactionId: attemptId,  // Usar ID gerado no início
        userId: session.data.userId,
        scenarioId: scenarioId,
        fil: validation.data.fil,
        psi: validation.data.psi,
        ia: validation.data.ia,
        freeText: freeText
      });
      if (!interaction.success) return interaction;

      // ✅ CORREÇÃO 4: Persistir pontuação calculada vinculada à tentativa
      var scoreData = null;
      if (processed.data && processed.data.score) {
        var scoreResult = ScoreController.createScore({
          userId: session.data.userId,
          scenarioId: scenarioId,
          interactionId: attemptId,  // Vínculo com a tentativa
          score: processed.data.score.baseScore || processed.data.score.finalScore,
          finalScore: processed.data.score.finalScore,
          xp: processed.data.score.xp || 0,
          difficulty: scenario.data.Difficulty || 'medium'
        });
        scoreData = scoreResult.success ? { scoreId: scoreResult.data.scoreId, finalScore: processed.data.score.finalScore, xp: processed.data.score.xp } : null;
      }

      var submitted = CauldronService.submitPotion(session.data.userId, { responseText: freeText });
      if (!submitted.success) return submitted;

      var generated = ResultService.generateResult(session.data.userId);
      var dashboard = getResultDashboard(token);
      return _ok({
        interactionId: attemptId,  // Retorna attemptId para cliente armazenar
        scenarioId: scenarioId,
        processing: processed.data,
        score: scoreData,
        result: generated.success ? generated.data : null,
        resultWarning: generated.success ? null : generated.error,
        dashboard: dashboard.success ? dashboard.data : null
      });
    } catch (err) {
      return _fail(err.message);
    }
  }

  function _formula(vocation) {
    return String((vocation && (vocation.Formula || vocation.EpistemicFormula)) || 'IA2 FIL1 PSI1');
  }

  function _vocationView(match) {
    var vocation = match && match.vocation ? match.vocation : {};
    return {
      id: vocation.VocationID || '',
      title: vocation.Title || 'Perfil em formação',
      description: vocation.Description || 'Continue resolvendo cenários para refinar esta recomendação.',
      formula: _formula(vocation),
      compatibility: Math.round(Number(match && match.compatibility) || 0)
    };
  }

  function getResultDashboard(token) {
    try {
      var session = _session(token);
      if (!session.success) return session;
      var dimensions = DimensionService.getAggregateVector(session.data.userId);
      if (!dimensions.success) return dimensions;
      var total = 0;
      DIMENSIONS.forEach(function (key) { total += Number(dimensions.data[key] || 0); });
      if (total <= 0) return _fail('Resolva pelo menos um cenário para gerar seu resultado.');

      var matches = ResultService.calculateVocationMatch(dimensions.data);
      if (!matches.success || !matches.data.length) return _fail((matches && matches.error) || 'Nenhuma vocação disponível.');
      var recommended = _vocationView(matches.data[0]);
      var vectors = {};
      DIMENSIONS.forEach(function (key) {
        vectors[key] = Math.round((Number(dimensions.data[key] || 0) / total) * 100);
      });
      var scenarioResult = ScenarioController.getAllScenarios();
      var scenarioTotal = scenarioResult.success ? scenarioResult.data.filter(function (row) {
        return String(row.Status || 'active').toLowerCase() === 'active';
      }).length : 0;
      var completed = Object.keys(_completedMap(session.data.userId)).length;
      return _ok({
        recommended: recommended,
        confidence: recommended.compatibility,
        vectors: vectors,
        scenariosCompleted: completed,
        scenariosTotal: scenarioTotal,
        alternatives: matches.data.slice(1, 6).map(_vocationView)
      });
    } catch (err) {
      return _fail(err.message);
    }
  }

  function generateReport(token) {
    try {
      var session = _session(token);
      if (!session.success) return session;
      return ResultService.generateReport(session.data.userId);
    } catch (err) {
      return _fail(err.message);
    }
  }

  function getHistory(token) {
    try {
      var session = _session(token);
      if (!session.success) return session;
      var userId = session.data.userId;
      var interactionsResult = InteractionController.getInteractionsByUser(userId);
      if (!interactionsResult.success) return interactionsResult;

      var scenariosResult = ScenarioController.getAllScenarios();
      var scenarioMap = {};
      if (scenariosResult.success) {
        scenariosResult.data.forEach(function (row) { scenarioMap[String(row.ScenarioID)] = row; });
      }

      var scoresResult = ScoreController.getScoresByUser(userId);
      var scoresByInteraction = {};
      if (scoresResult.success) {
        scoresResult.data.forEach(function (row) {
          var key = String(row.InteractionID || '');
          if (key) scoresByInteraction[key] = row;  // ✅ CORREÇÃO: Vínculo direto por InteractionID
        });
      }

      var attempts = interactionsResult.data.map(function (row) {
        var scenarioId = String(row.ScenarioID || '');
        var interactionId = String(row.InteractionID || row.ID || '');
        var scenario = scenarioMap[scenarioId] || {};
        var scoreRow = scoresByInteraction[interactionId] || null;  // ✅ CORREÇÃO: Busca exata por ID
        var score = scoreRow ? Number(scoreRow.FinalScore !== undefined ? scoreRow.FinalScore : scoreRow.Score) : null;
        return {
          id: String(row.InteractionID || row.ID || ''),
          scenarioId: scenarioId,
          title: String(scenario.Title || 'Cenário'),
          category: String(scenario.Category || 'geral'),
          difficulty: String(scenario.Difficulty || 'medium'),
          score: isFinite(score) ? Math.round(score) : null,
          fil: Number(row.FIL || 0),
          psi: Number(row.PSI || 0),
          ia: Number(row.IA || 0),
          response: String(row.FreeText || row.Response || ''),
          completedAt: row.CreatedAt instanceof Date ? row.CreatedAt.toISOString() : String(row.CreatedAt || '')
        };
      });
      attempts.sort(function (a, b) { return b.completedAt.localeCompare(a.completedAt); });

      var scored = attempts.filter(function (item) { return item.score !== null; });
      var scoreValues = scored.map(function (item) { return item.score; });
      var unique = {};
      attempts.forEach(function (item) { if (item.scenarioId) unique[item.scenarioId] = true; });
      return _ok({
        attempts: attempts,
        summary: {
          attempts: attempts.length,
          completedScenarios: Object.keys(unique).length,
          averageScore: scoreValues.length ? Math.round(scoreValues.reduce(function (sum, value) { return sum + value; }, 0) / scoreValues.length) : null,
          bestScore: scoreValues.length ? Math.max.apply(null, scoreValues) : null
        }
      });
    } catch (err) {
      return _fail(err.message, { attempts: [], summary: { attempts: 0, completedScenarios: 0, averageScore: null, bestScore: null } });
    }
  }

  return {
    getWelcome: getWelcome,
    getScenarios: getScenarios,
    getScenario: getScenario,
    previewPotion: previewPotion,
    submitPotion: submitPotion,
    getResultDashboard: getResultDashboard,
    generateReport: generateReport,
    getHistory: getHistory
  };
})();
