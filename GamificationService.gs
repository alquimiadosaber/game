/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — GamificationService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Gamificação do simulador. Gerencia XP, conquistas, medalhas e sistema de progressão para motivar completude.
 *
 * FUNCIONALIDADES:
 *   • getUserLevel(userId) — Retorna nível XP.
   • addXP(userId, amount) — Adiciona XP.
   • checkAchievements(userId) — Verifica conquistas.
   • unlockAchievement(userId, achievementId) — Desbloqueia.
   • getAchievements() — Lista todas as conquistas.
   • getBadges(userId) — Medalhas do utilizador.
   • getProgressionStatus(userId) — Status completo.
 *
 * INTEGRAÇÕES:
 *   • SpreadsheetApp — abas Scores e Users.
   • ScoreService — XP por pontuações.
   • UserController — atualização de perfil.
   • LoggerService — registro de conquistas.
   • NotificationService — notificação de conquistas.
 * XP-based progression — experiência acumulada determina nível.
   Achievement system — badges por marcos específicos.
   Motivation loop — recompensas incentivam continuidade.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const GamificationService = (function () {

  var XP_PER_LEVEL = 100;
  var MAX_LEVEL = 50;

  var ACHIEVEMENTS = [
    { id: 'first_scenario', name: 'Primeiro Passo', description: 'Complete o primeiro cenário', requirement: 'scenarios', threshold: 1, xpBonus: 50 },
    { id: 'five_scenarios', name: 'Explorador', description: 'Complete 5 cenários', requirement: 'scenarios', threshold: 5, xpBonus: 100 },
    { id: 'ten_scenarios', name: 'Investigador', description: 'Complete 10 cenários', requirement: 'scenarios', threshold: 10, xpBonus: 200 },
    { id: 'all_domains', name: 'Polímata', description: 'Explore todos os 6 domínios', requirement: 'domains', threshold: 6, xpBonus: 300 },
    { id: 'level_10', name: 'Aprendiz', description: 'Alcance nível 10', requirement: 'level', threshold: 10, xpBonus: 150 },
    { id: 'level_25', name: 'Mestre', description: 'Alcance nível 25', requirement: 'level', threshold: 25, xpBonus: 400 },
    { id: 'perfect_score', name: 'Perfeição', description: 'Obtenha pontuação perfeita (100%)', requirement: 'perfect', threshold: 1, xpBonus: 500 }
  ];

  function _calculateLevel(totalXP) {
    var level = Math.floor(totalXP / XP_PER_LEVEL) + 1;
    return Math.min(level, MAX_LEVEL);
  }

  function _getXPForNextLevel(currentXP) {
    var currentLevel = _calculateLevel(currentXP);
    if (currentLevel >= MAX_LEVEL) return 0;
    return (currentLevel * XP_PER_LEVEL) - currentXP;
  }

  function _getUserXP(userId) {
    var result = Utils.getAllRows('UserXP');
    if (!result.success) return 0;
    
    var userXP = result.data.filter(function(row) {
      return row.UserID === userId;
    })[0];
    
    return userXP ? Number(userXP.TotalXP || 0) : 0;
  }

  function _getUserAchievements(userId) {
    var result = Utils.getAllRows('UserAchievements');
    if (!result.success) return [];
    
    return result.data.filter(function(row) {
      return row.UserID === userId;
    }).map(function(row) {
      return row.AchievementID;
    });
  }

  function getUserLevel(userId) {
    try {
      var totalXP = _getUserXP(userId);
      var level = _calculateLevel(totalXP);
      var xpForNext = _getXPForNextLevel(totalXP);
      var progress = totalXP % XP_PER_LEVEL;
      
      return {
        success: true,
        data: {
          level: level,
          totalXP: totalXP,
          xpForNextLevel: xpForNext,
          progressToNextLevel: progress,
          progressPercentage: (progress / XP_PER_LEVEL) * 100
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function addXP(userId, amount) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      
      var xpAmount = Number(amount || 0);
      if (xpAmount <= 0) {
        return { success: false, data: null, error: 'Quantidade de XP deve ser positiva.' };
      }
      
      var sheet = Utils.getSheet('UserXP');
      if (!sheet) return { success: false, data: null, error: 'Aba UserXP não encontrada.' };
      
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var userIdCol = headers.indexOf('UserID');
      var xpCol = headers.indexOf('TotalXP');
      
      if (userIdCol === -1 || xpCol === -1) {
        return { success: false, data: null, error: 'Colunas necessárias não encontradas.' };
      }
      
      var rowIndex = -1;
      for (var i = 1; i < values.length; i++) {
        if (values[i][userIdCol] === userId) {
          rowIndex = i;
          break;
        }
      }
      
      var oldLevel = 1;
      var newXP = xpAmount;
      
      if (rowIndex === -1) {
        var addResult = Utils.addRow('UserXP', {
          UserID: userId,
          TotalXP: xpAmount,
          UpdatedAt: Utils.getTimestamp()
        });
        if (!addResult.success) return addResult;
      } else {
        var currentXP = Number(values[rowIndex][xpCol] || 0);
        oldLevel = _calculateLevel(currentXP);
        newXP = currentXP + xpAmount;
        values[rowIndex][xpCol] = newXP;
        
        var updatedAtCol = headers.indexOf('UpdatedAt');
        if (updatedAtCol !== -1) {
          values[rowIndex][updatedAtCol] = Utils.getTimestamp();
        }
        
        sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      }
      
      var newLevel = _calculateLevel(newXP);
      var leveledUp = newLevel > oldLevel;
      
      return {
        success: true,
        data: {
          userId: userId,
          xpAdded: xpAmount,
          totalXP: newXP,
          oldLevel: oldLevel,
          newLevel: newLevel,
          leveledUp: leveledUp
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function getAchievements() {
    return { success: true, data: ACHIEVEMENTS, error: null };
  }

  function unlockAchievement(userId, achievementId) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      
      var unlockedIds = _getUserAchievements(userId);
      if (unlockedIds.indexOf(achievementId) !== -1) {
        return { success: false, data: null, error: 'Conquista já desbloqueada.' };
      }
      
      var achievement = ACHIEVEMENTS.filter(function(a) {
        return a.id === achievementId;
      })[0];
      
      if (!achievement) {
        return { success: false, data: null, error: 'Conquista não encontrada.' };
      }
      
      var addResult = Utils.addRow('UserAchievements', {
        UserID: userId,
        AchievementID: achievementId,
        UnlockedAt: Utils.getTimestamp()
      });
      
      if (!addResult.success) return addResult;
      
      // Adiciona XP bonus
      if (achievement.xpBonus > 0) {
        addXP(userId, achievement.xpBonus);
      }
      
      try {
        if (typeof LoggerService !== 'undefined' && LoggerService.log) {
          LoggerService.log('ACHIEVEMENT', userId, { achievementId: achievementId, name: achievement.name });
        }
      } catch (err) {
        // Log é auxiliar
      }
      
      return {
        success: true,
        data: {
          userId: userId,
          achievement: achievement,
          xpBonusAwarded: achievement.xpBonus
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function checkAchievements(userId) {
    try {
      var unlocked = [];
      var unlockedIds = _getUserAchievements(userId);
      
      // Busca estatísticas do utilizador
      var resultsResult = Utils.getAllRows('Results');
      var userResults = resultsResult.success ? resultsResult.data.filter(function(r) {
        return r.UserID === userId;
      }) : [];
      
      var scenariosCompleted = userResults.length;
      var userLevel = getUserLevel(userId);
      var currentLevel = userLevel.success ? userLevel.data.level : 1;
      
      // Verifica cada conquista
      ACHIEVEMENTS.forEach(function(achievement) {
        if (unlockedIds.indexOf(achievement.id) !== -1) return;
        
        var shouldUnlock = false;
        
        if (achievement.requirement === 'scenarios') {
          shouldUnlock = scenariosCompleted >= achievement.threshold;
        } else if (achievement.requirement === 'level') {
          shouldUnlock = currentLevel >= achievement.threshold;
        } else if (achievement.requirement === 'perfect') {
          shouldUnlock = userResults.some(function(r) {
            return Number(r.Score || 0) >= 100;
          });
        } else if (achievement.requirement === 'domains') {
          var uniqueDomains = {};
          userResults.forEach(function(r) {
            if (r.VocationID) {
              var vocResult = VocationController.getVocationById(r.VocationID);
              if (vocResult.success && vocResult.data) {
                uniqueDomains[vocResult.data.Domain] = true;
              }
            }
          });
          shouldUnlock = Object.keys(uniqueDomains).length >= achievement.threshold;
        }
        
        if (shouldUnlock) {
          var unlockResult = unlockAchievement(userId, achievement.id);
          if (unlockResult.success) {
            unlocked.push(achievement);
          }
        }
      });
      
      return { success: true, data: unlocked, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function getBadges(userId) {
    try {
      var unlockedIds = _getUserAchievements(userId);
      var badges = ACHIEVEMENTS.filter(function(a) {
        return unlockedIds.indexOf(a.id) !== -1;
      });
      
      return { success: true, data: badges, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function getProgressionStatus(userId) {
    try {
      var levelInfo = getUserLevel(userId);
      var badges = getBadges(userId);
      
      var resultsResult = Utils.getAllRows('Results');
      var userResults = resultsResult.success ? resultsResult.data.filter(function(r) {
        return r.UserID === userId;
      }) : [];
      
      return {
        success: true,
        data: {
          level: levelInfo.success ? levelInfo.data : null,
          badges: badges.success ? badges.data : [],
          scenariosCompleted: userResults.length,
          totalAchievements: ACHIEVEMENTS.length,
          achievementsUnlocked: badges.success ? badges.data.length : 0
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    getUserLevel: getUserLevel,
    addXP: addXP,
    checkAchievements: checkAchievements,
    unlockAchievement: unlockAchievement,
    getAchievements: getAchievements,
    getBadges: getBadges,
    getProgressionStatus: getProgressionStatus
  };
})();
