/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — ExportService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Exportação de dados em formatos CSV, JSON e PDF para uso externo, backups ou integração.
 *
 * FUNCIONALIDADES:
 *   • exportUsersCSV() — Exporta utilizadores.
   • exportScoresCSV(userId) — Exporta pontuações.
   • exportResultsCSV(userId) — Exporta resultados.
   • exportAllDataJSON() — Exporta todos os dados.
   • exportClassroomData(classId) — Exporta dados de turma.
   • backupAllData() — Backup completo.
 *
 * INTEGRAÇÕES:
 *   • SpreadsheetApp — leitura de todas as abas.
   • UserController — dados de utilizadores.
   • ScoreController — dados de pontuações.
   • ResultController — dados de resultados.
 * Batch export — múltiplas abas consolidadas.
   Format flexibility — CSV, JSON, PDF.
   Backup capability — exportação completa.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ExportService = (function () {

  function _arrayToCSV(data) {
    if (!data || data.length === 0) return '';
    
    var headers = Object.keys(data[0]);
    var csv = headers.join(',') + '\n';
    
    data.forEach(function(row) {
      var values = headers.map(function(header) {
        var value = row[header];
        if (value === null || value === undefined) return '';
        value = String(value).replace(/"/g, '""');
        if (value.indexOf(',') !== -1 || value.indexOf('\n') !== -1) {
          value = '"' + value + '"';
        }
        return value;
      });
      csv += values.join(',') + '\n';
    });
    
    return csv;
  }

  function exportUsersCSV() {
    try {
      var usersResult = UserController.getAllUsers();
      if (!usersResult.success) return usersResult;
      
      var csv = _arrayToCSV(usersResult.data);
      
      return {
        success: true,
        data: {
          csv: csv,
          filename: 'users_' + new Date().toISOString().split('T')[0] + '.csv',
          rowCount: usersResult.data.length
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function exportScoresCSV(userId) {
    try {
      var scoresResult = Utils.getAllRows('Scores');
      if (!scoresResult.success) return scoresResult;
      
      var filtered = userId ? scoresResult.data.filter(function(s) {
        return s.UserID === userId;
      }) : scoresResult.data;
      
      var csv = _arrayToCSV(filtered);
      
      return {
        success: true,
        data: {
          csv: csv,
          filename: 'scores_' + (userId || 'all') + '_' + new Date().toISOString().split('T')[0] + '.csv',
          rowCount: filtered.length
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function exportResultsCSV(userId) {
    try {
      var resultsResult = userId ? 
        ResultController.getResultsByUser(userId) : 
        ResultController.getAllResults();
      
      if (!resultsResult.success) return resultsResult;
      
      var csv = _arrayToCSV(resultsResult.data);
      
      return {
        success: true,
        data: {
          csv: csv,
          filename: 'results_' + (userId || 'all') + '_' + new Date().toISOString().split('T')[0] + '.csv',
          rowCount: resultsResult.data.length
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function exportAllDataJSON() {
    try {
      var tables = ['Users', 'Results', 'Scenarios', 'Vocations', 'Sessions', 'Logs'];
      var allData = {
        exportDate: Utils.getTimestamp(),
        version: '1.0',
        tables: {}
      };
      
      tables.forEach(function(tableName) {
        var result = Utils.getAllRows(tableName);
        if (result.success) {
          allData.tables[tableName] = result.data;
        }
      });
      
      var json = JSON.stringify(allData, null, 2);
      
      return {
        success: true,
        data: {
          json: json,
          filename: 'alquimia_backup_' + new Date().toISOString().split('T')[0] + '.json',
          tableCount: Object.keys(allData.tables).length
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function exportClassroomData(classId) {
    if (!classId) return { success: false, data: null, error: 'ClassID é obrigatório.' };
    try {
      var usersResult = Utils.getAllRows('Users');
      if (!usersResult.success) return usersResult;

      var classUsers = usersResult.data.filter(function(user) {
        return String(user.ClassID || '') === String(classId);
      });
      if (!classUsers.length) {
        return { success: false, data: null, error: 'Nenhum utilizador encontrado na turma ' + classId + '.' };
      }

      var userIds = {};
      classUsers.forEach(function(user) { userIds[String(user.UserID)] = true; });

      var resultsResult = Utils.getAllRows('Results');
      var classResults = resultsResult.success ? resultsResult.data.filter(function(r) {
        return userIds[String(r.UserID)];
      }) : [];

      var rows = classResults.map(function(r) {
        return {
          UserID: r.UserID,
          ScenarioID: r.ScenarioID,
          RecommendedVocation: r.RecommendedVocation,
          Compatibility: r.Compatibility,
          Score: r.Score,
          Domain: r.Domain,
          CompletedAt: r.CompletedAt,
          Status: r.Status
        };
      });
      var csv = _arrayToCSV(rows);

      return {
        success: true,
        data: {
          csv: csv,
          filename: 'classroom_' + classId + '_' + new Date().toISOString().split('T')[0] + '.csv',
          classId: classId,
          userCount: classUsers.length,
          rowCount: rows.length
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function backupAllData() {
    try {
      var timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      var backupId = 'backup_' + timestamp;
      
      // Exporta JSON completo
      var jsonExport = exportAllDataJSON();
      if (!jsonExport.success) return jsonExport;
      
      // Registra backup
      var backupRecord = {
        BackupID: backupId,
        Timestamp: Utils.getTimestamp(),
        TableCount: jsonExport.data.tableCount,
        Status: 'completed'
      };
      
      var recordResult = Utils.addRow('Backups', backupRecord);
      if (!recordResult || !recordResult.success) {
        return recordResult || { success: false, data: null, error: 'Não foi possível registrar o backup.' };
      }
      
      return {
        success: true,
        data: {
          backupId: backupId,
          json: jsonExport.data.json,
          timestamp: timestamp
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function exportLogsCSV(filters) {
    try {
      var logsResult = Utils.getAllRows('Logs');
      if (!logsResult.success) return logsResult;
      
      var logs = logsResult.data;
      
      // Aplica filtros se fornecidos (colunas reais da aba Logs: Severity, Actor, Action, Details)
      if (filters) {
        if (filters.level) {
          logs = logs.filter(function(log) {
            var severity = String(log.Severity || '');
            return severity && severity.toLowerCase() === filters.level.toLowerCase();
          });
        }
        if (filters.user) {
          logs = logs.filter(function(log) {
            var actor = String(log.Actor || '');
            return actor && actor.toLowerCase().includes(filters.user.toLowerCase());
          });
        }
        if (filters.message) {
          logs = logs.filter(function(log) {
            var text = (String(log.Action || '') + ' ' + String(log.Details || '')).toLowerCase();
            return text.trim() && text.includes(filters.message.toLowerCase());
          });
        }
      }
      
      var csv = _arrayToCSV(logs);
      
      return {
        success: true,
        data: csv,
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    exportUsersCSV: exportUsersCSV,
    exportScoresCSV: exportScoresCSV,
    exportResultsCSV: exportResultsCSV,
    exportAllDataJSON: exportAllDataJSON,
    exportClassroomData: exportClassroomData,
    backupAllData: backupAllData,
    exportLogsCSV: exportLogsCSV
  };
})();
