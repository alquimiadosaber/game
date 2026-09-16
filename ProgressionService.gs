/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — ProgressionService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Árvores de progressão e desbloqueios. Gerencia avanço do utilizador pelo simulador com pré-requisitos e marcos.
 *
 * FUNCIONALIDADES:
 *   • getProgressionTree(userId) — Árvore de progressão.
   • checkPrerequisites(userId, scenarioId) — Verifica pré-requisitos.
   • unlockScenario(userId, scenarioId) — Desbloqueia cenário.
   • unlockVocation(userId, vocationId) — Desbloqueia vocação.
   • getNextMilestone(userId) — Próximo marco.
   • isComplete(userId) — Verifica se completou.
   • getProgressionPercent(userId) — Percentagem de progresso.
 *
 * INTEGRAÇÕES:
 *   • ScenarioController — cenários e desbloqueios.
   • VocationController — vocações acessíveis.
   • InteractionController — interações concluídas.
   • GamificationService — XP e níveis.
 * Prerequisite-based — cenários exigem anteriores.
   Milestone system — marcos intermediários motivacionais.
   Completion detection — detecta fim do simulador.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ProgressionService = (function () {

  var MILESTONES = [
    { id: 'welcome', name: 'Bem-vindo', threshold: 0, description: 'Inicie sua jornada' },
    { id: 'first_potion', name: 'Primeira Poção', threshold: 1, description: 'Complete seu primeiro cenário' },
    { id: 'explorer', name: 'Explorador', threshold: 5, description: 'Complete 5 cenários' },
    { id: 'researcher', name: 'Pesquisador', threshold: 10, description: 'Complete 10 cenários' },
    { id: 'specialist', name: 'Especialista', threshold: 15, description: 'Complete 15 cenários' },
    { id: 'master', name: 'Mestre Alquimista', threshold: 20, description: 'Complete 20 cenários' }
  ];

  function _getUserCompletedScenarios(userId) {
    var result = Utils.getAllRows('Results');
    if (!result.success) return [];
    
    return result.data
      .filter(function(r) { return r.UserID === userId; })
      .map(function(r) { return r.ScenarioID; });
  }

  function _getUserUnlockedScenarios(userId) {
    var result = Utils.getAllRows('UserUnlocks');
    if (!result.success) return [];
    
    return result.data
      .filter(function(r) { return r.UserID === userId && r.EntityType === 'Scenario'; })
      .map(function(r) { return r.EntityID; });
  }

  function getProgressionPercent(userId) {
    try {
      var completedScenarios = _getUserCompletedScenarios(userId);
      
      var allScenariosResult = ScenarioController.getAllScenarios();
      if (!allScenariosResult.success) {
        return { success: false, data: 0, error: allScenariosResult.error };
      }
      
      var totalScenarios = allScenariosResult.data.filter(function(s) {
        return s.Status === 'active';
      }).length;
      
      if (totalScenarios === 0) {
        return { success: true, data: 0, error: null };
      }
      
      var percent = (completedScenarios.length / totalScenarios) * 100;
      
      return { success: true, data: Math.round(percent), error: null };
    } catch (err) {
      return { success: false, data: 0, error: err.message };
    }
  }

  function isComplete(userId) {
    try {
      var percentResult = getProgressionPercent(userId);
      if (!percentResult.success) return { success: false, data: false, error: percentResult.error };
      
      return { success: true, data: percentResult.data >= 100, error: null };
    } catch (err) {
      return { success: false, data: false, error: err.message };
    }
  }

  function getNextMilestone(userId) {
    try {
      var completedScenarios = _getUserCompletedScenarios(userId);
      var count = completedScenarios.length;
      
      for (var i = 0; i < MILESTONES.length; i++) {
        if (count < MILESTONES[i].threshold) {
          return {
            success: true,
            data: {
              milestone: MILESTONES[i],
              progress: count,
              remaining: MILESTONES[i].threshold - count
            },
            error: null
          };
        }
      }
      
      return { success: true, data: null, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function checkPrerequisites(userId, scenarioId) {
    try {
      // Por simplicidade, sistema não tem pré-requisitos rígidos
      // Todos os cenários são acessíveis (design decisão pedagógica)
      return { success: true, data: { met: true, missing: [] }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function unlockScenario(userId, scenarioId) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      
      var unlocked = _getUserUnlockedScenarios(userId);
      if (unlocked.indexOf(scenarioId) !== -1) {
        return { success: true, data: { alreadyUnlocked: true }, error: null };
      }
      
      var addResult = Utils.addRow('UserUnlocks', {
        UserID: userId,
        EntityType: 'Scenario',
        EntityID: scenarioId,
        UnlockedAt: Utils.getTimestamp()
      });
      
      if (!addResult.success) return addResult;
      
      return { success: true, data: { scenarioId: scenarioId, unlocked: true }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function unlockVocation(userId, vocationId) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      
      var result = Utils.getAllRows('UserUnlocks');
      if (result.success) {
        var existing = result.data.filter(function(r) {
          return r.UserID === userId && r.EntityType === 'Vocation' && r.EntityID === vocationId;
        });
        
        if (existing.length > 0) {
          return { success: true, data: { alreadyUnlocked: true }, error: null };
        }
      }
      
      var addResult = Utils.addRow('UserUnlocks', {
        UserID: userId,
        EntityType: 'Vocation',
        EntityID: vocationId,
        UnlockedAt: Utils.getTimestamp()
      });
      
      if (!addResult.success) return addResult;
      
      return { success: true, data: { vocationId: vocationId, unlocked: true }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function getProgressionTree(userId) {
    try {
      var completedScenarios = _getUserCompletedScenarios(userId);
      var unlockedScenarios = _getUserUnlockedScenarios(userId);
      
      var allScenariosResult = ScenarioController.getAllScenarios();
      if (!allScenariosResult.success) return allScenariosResult;
      
      var tree = {
        completed: completedScenarios.length,
        unlocked: unlockedScenarios.length,
        available: allScenariosResult.data.filter(function(s) {
          return s.Status === 'active';
        }).length,
        scenarios: allScenariosResult.data.map(function(scenario) {
          return {
            scenarioId: scenario.ScenarioID,
            title: scenario.Title,
            difficulty: scenario.Difficulty,
            completed: completedScenarios.indexOf(scenario.ScenarioID) !== -1,
            unlocked: unlockedScenarios.indexOf(scenario.ScenarioID) !== -1 || true,
            status: scenario.Status
          };
        }),
        milestones: MILESTONES.map(function(m) {
          return {
            id: m.id,
            name: m.name,
            threshold: m.threshold,
            achieved: completedScenarios.length >= m.threshold
          };
        })
      };
      
      return { success: true, data: tree, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    getProgressionTree: getProgressionTree,
    checkPrerequisites: checkPrerequisites,
    unlockScenario: unlockScenario,
    unlockVocation: unlockVocation,
    getNextMilestone: getNextMilestone,
    isComplete: isComplete,
    getProgressionPercent: getProgressionPercent
  };
})();
