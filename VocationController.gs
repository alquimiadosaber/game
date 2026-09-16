/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — VocationController.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Controlador CRUD para a entidade Vocações. Gerencia as 60 carreiras vocacionais catalogadas nos 6 domínios (A-F).
 *
 * FUNCIONALIDADES:
 *   • createVocation(data) — Cria vocação (create).
   • getAllVocations() — Lista todas as 60 carreiras (read).
   • getVocationById(id) — Busca por ID (read).
   • updateVocation(id, data) — Atualiza (update).
   • deleteVocation(id) — Remove (delete).
   • getVocationsByDomain(domain) — Filtra por domínio (read).
   • getVocationsByFormula(formula) — Filtra por fórmula (read).
   • searchVocations(query) — Busca por título/descrição (read).
   • matchVocation(dimensions) — Encontra mais compatível.
   • parseFormula(formula) — Analisa fórmula epistémica.
   • importVocations(payload) — Importação em lote (CSV/JSON, append/replace).
 *
 * INTEGRAÇÕES:
 *   • SpreadsheetApp — aba Vocations.
   • DimensionService — cálculo de compatibilidade.
   • TaxonomyService — mapeamento de domínios.
   • CacheService — cache das 60 vocações.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const VocationController = (function () {

  function _logCRUD(action, vocationId, actorId) {
    try {
      if (typeof LoggerService !== 'undefined' && LoggerService.logCRUD) {
        LoggerService.logCRUD('Vocations', action, vocationId, actorId);
      }
    } catch (err) {
      // Auditoria é auxiliar
    }
  }

  function createVocation(data) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      
      var vocationId = Utils.generateId();
      var vocationData = {
        VocationID: vocationId,
        Title: String(data.title || '').trim(),
        Description: String(data.description || '').trim(),
        Domain: String(data.domain || 'A').toUpperCase(),
        Formula: String(data.formula || '').trim(),
        Status: String(data.status || 'active'),
        CreatedAt: Utils.getTimestamp(),
        UpdatedAt: Utils.getTimestamp()
      };
      
      if (!vocationData.Title || vocationData.Title.length < 3) {
        return { success: false, data: null, error: 'Título da vocação é obrigatório (mín. 3 caracteres).' };
      }
      
      var validDomains = ['A', 'B', 'C', 'D', 'E', 'F'];
      if (validDomains.indexOf(vocationData.Domain) === -1) {
        return { success: false, data: null, error: 'Domínio deve ser A, B, C, D, E ou F.' };
      }
      
      var result = Utils.addRow('Vocations', vocationData);
      if (!result.success) return result;
      
      _logCRUD('CREATE', vocationId, data.createdBy || 'system');
      
      return { success: true, data: { vocationId: vocationId }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function getAllVocations() {
    try {
      var result = Utils.getAllRows('Vocations');
      if (!result.success) return result;
      return { success: true, data: result.data, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function getVocationById(vocationId) {
    try {
      var result = Utils.getAllRows('Vocations');
      if (!result.success) return result;
      
      var vocation = result.data.filter(function(v) {
        return v.VocationID === vocationId;
      })[0];
      
      if (!vocation) {
        return { success: false, data: null, error: 'Vocação não encontrada.' };
      }
      
      return { success: true, data: vocation, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function updateVocation(vocationId, data) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('Vocations');
      if (!sheet) return { success: false, data: null, error: 'Aba Vocations não encontrada.' };
      
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var idCol = headers.indexOf('VocationID');
      if (idCol === -1) return { success: false, data: null, error: 'Coluna VocationID não encontrada.' };
      
      var rowIndex = -1;
      for (var i = 1; i < values.length; i++) {
        if (values[i][idCol] === vocationId) {
          rowIndex = i;
          break;
        }
      }
      if (rowIndex === -1) {
        return { success: false, data: null, error: 'Vocação não encontrada.' };
      }
      
      var updatableFields = ['Title', 'Description', 'Domain', 'Formula', 'Status'];
      updatableFields.forEach(function(field) {
        var colIndex = headers.indexOf(field);
        if (colIndex !== -1 && data[field] !== undefined) {
          values[rowIndex][colIndex] = data[field];
        }
      });
      
      var updatedAtCol = headers.indexOf('UpdatedAt');
      if (updatedAtCol !== -1) {
        values[rowIndex][updatedAtCol] = Utils.getTimestamp();
      }
      
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      _logCRUD('UPDATE', vocationId, data.actorId || 'system');
      
      return { success: true, data: { vocationId: vocationId }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function deleteVocation(vocationId) {
    return updateVocation(vocationId, { Status: 'inactive', actorId: 'system' });
  }

  function getVocationsByDomain(domain) {
    try {
      var result = getAllVocations();
      if (!result.success) return result;
      
      var normalized = String(domain || '').toUpperCase();
      var filtered = result.data.filter(function(vocation) {
        return String(vocation.Domain || '').toUpperCase() === normalized;
      });
      
      return { success: true, data: filtered, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function searchVocations(query) {
    try {
      var result = getAllVocations();
      if (!result.success) return result;
      
      var q = String(query || '').toLowerCase().trim();
      if (!q) return result;
      
      var filtered = result.data.filter(function(vocation) {
        var title = String(vocation.Title || '').toLowerCase();
        var description = String(vocation.Description || '').toLowerCase();
        return title.indexOf(q) !== -1 || description.indexOf(q) !== -1;
      });
      
      return { success: true, data: filtered, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function parseFormula(formula) {
    try {
      var f = String(formula || '').trim().toUpperCase();
      if (!f) return { success: false, data: null, error: 'Fórmula vazia.' };

      // Aceita tanto o formato técnico "IA2 FIL1 PSI1" quanto o formato
      // editorial do catálogo "2/4 IA, 1/4 FIL, 1/4 PSI".
      var dimensions = {};
      var fractionPattern = /(\d+)\s*\/\s*4\s*([A-Z]+)/g;
      var compactPattern = /([A-Z]+)\s*:?\s*(\d+)/g;
      var match;
      while ((match = fractionPattern.exec(f)) !== null) {
        dimensions[match[2]] = parseInt(match[1], 10);
      }
      while ((match = compactPattern.exec(f)) !== null) {
        dimensions[match[1]] = parseInt(match[2], 10);
      }
      if (!Object.keys(dimensions).length) {
        return { success: false, data: null, error: 'Fórmula inválida.' };
      }
      return { success: true, data: dimensions, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function matchVocation(dimensions) {
    try {
      var result = getAllVocations();
      if (!result.success) return result;
      
      var activeVocations = result.data.filter(function(v) {
        return v.Status === 'active';
      });
      
      if (activeVocations.length === 0) {
        return { success: false, data: null, error: 'Nenhuma vocação ativa disponível.' };
      }
      
      // Calcula compatibilidade simples: soma de diferenças absolutas
      var bestMatch = null;
      var bestScore = Infinity;
      
      activeVocations.forEach(function(vocation) {
        var formulaResult = parseFormula(vocation.Formula);
        if (!formulaResult.success) return;
        
        var vocationDims = formulaResult.data;
        var score = 0;
        
        Object.keys(dimensions).forEach(function(dim) {
          var userVal = dimensions[dim] || 0;
          var vocVal = vocationDims[dim] || 0;
          score += Math.abs(userVal - vocVal);
        });
        
        if (score < bestScore) {
          bestScore = score;
          bestMatch = vocation;
        }
      });
      
      return { success: true, data: { vocation: bestMatch, score: bestScore }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function importVocations(payload) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      
      if (!payload || !payload.data) {
        return { success: false, data: null, error: 'Dados de importação ausentes.' };
      }
      
      var format = payload.format || 'json'; // 'json' ou 'csv'
      var mode = payload.mode || 'append'; // 'append' ou 'replace'
      var vocations = [];
      
      // Parse JSON
      if (format === 'json') {
        try {
          var jsonData = typeof payload.data === 'string' ? JSON.parse(payload.data) : payload.data;
          
          // Suporta formato direto ou com wrapper
          if (Array.isArray(jsonData)) {
            vocations = jsonData;
          } else if (jsonData.vocations && Array.isArray(jsonData.vocations)) {
            vocations = jsonData.vocations;
          } else if (jsonData.tables && jsonData.tables.Vocations) {
            vocations = jsonData.tables.Vocations;
          } else {
            return { success: false, data: null, error: 'Formato JSON inválido. Esperado array de vocações.' };
          }
        } catch (parseErr) {
          return { success: false, data: null, error: 'Erro ao parsear JSON: ' + parseErr.message };
        }
      }
      
      // Parse CSV
      else if (format === 'csv') {
        try {
          var lines = payload.data.split('\n').filter(function(line) { return line.trim(); });
          if (lines.length < 2) {
            return { success: false, data: null, error: 'CSV deve ter header e pelo menos 1 linha de dados.' };
          }
          
          var headers = lines[0].split(',').map(function(h) { return h.trim(); });
          
          for (var i = 1; i < lines.length; i++) {
            var values = lines[i].split(',').map(function(v) { return v.trim().replace(/^"|"$/g, ''); });
            var vocation = {};
            
            headers.forEach(function(header, idx) {
              if (values[idx] !== undefined) {
                vocation[header] = values[idx];
              }
            });
            
            vocations.push(vocation);
          }
        } catch (csvErr) {
          return { success: false, data: null, error: 'Erro ao parsear CSV: ' + csvErr.message };
        }
      } else {
        return { success: false, data: null, error: 'Formato não suportado. Use "json" ou "csv".' };
      }
      
      if (vocations.length === 0) {
        return { success: false, data: null, error: 'Nenhuma vocação encontrada para importar.' };
      }
      
      // Validação e normalização
      var validDomains = ['A', 'B', 'C', 'D', 'E', 'F'];
      var created = 0;
      var updated = 0;
      var skipped = 0;
      var errors = [];
      
      // Se mode = 'replace', desativa todas as existentes primeiro
      if (mode === 'replace') {
        var existingResult = getAllVocations();
        if (existingResult.success) {
          existingResult.data.forEach(function(v) {
            updateVocation(v.VocationID, { Status: 'inactive', actorId: 'import-system' });
          });
        }
      }
      
      vocations.forEach(function(voc, idx) {
        try {
          var title = String(voc.Title || voc.title || '').trim();
          var domain = String(voc.Domain || voc.domain || 'A').toUpperCase().trim();
          var description = String(voc.Description || voc.description || '').trim();
          var formula = voc.EpistemicFormula || voc.Formula || voc.formula || '';
          
          // Validação básica
          if (!title || title.length < 3) {
            errors.push('Linha ' + (idx + 1) + ': Título inválido');
            skipped++;
            return;
          }
          
          if (validDomains.indexOf(domain) === -1) {
            errors.push('Linha ' + (idx + 1) + ': Domínio inválido (' + domain + ')');
            skipped++;
            return;
          }
          
          // Se tem VocationID, tenta atualizar; senão cria nova
          if (voc.VocationID) {
            var updateResult = updateVocation(voc.VocationID, {
              Title: title,
              Domain: domain,
              Description: description,
              Formula: formula,
              Status: voc.Status || 'active',
              actorId: 'import-system'
            });
            
            if (updateResult.success) {
              updated++;
            } else {
              // Se não encontrou, cria nova
              var createData = {
                title: title,
                domain: domain,
                description: description,
                formula: formula,
                status: voc.Status || 'active',
                createdBy: 'import-system'
              };
              
              var createResult = createVocation(createData);
              if (createResult.success) {
                created++;
              } else {
                errors.push('Linha ' + (idx + 1) + ': ' + createResult.error);
                skipped++;
              }
            }
          } else {
            // Cria nova vocação
            var createData = {
              title: title,
              domain: domain,
              description: description,
              formula: formula,
              status: voc.Status || voc.status || 'active',
              createdBy: 'import-system'
            };
            
            var createResult = createVocation(createData);
            if (createResult.success) {
              created++;
            } else {
              errors.push('Linha ' + (idx + 1) + ': ' + createResult.error);
              skipped++;
            }
          }
        } catch (itemErr) {
          errors.push('Linha ' + (idx + 1) + ': ' + itemErr.message);
          skipped++;
        }
      });
      
      _logCRUD('IMPORT', 'bulk', 'import-system');
      
      return {
        success: true,
        data: {
          created: created,
          updated: updated,
          skipped: skipped,
          total: vocations.length,
          errors: errors.length > 0 ? errors : null
        },
        error: null
      };
      
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  return {
    createVocation: createVocation,
    getAllVocations: getAllVocations,
    getVocationById: getVocationById,
    updateVocation: updateVocation,
    deleteVocation: deleteVocation,
    getVocationsByDomain: getVocationsByDomain,
    searchVocations: searchVocations,
    matchVocation: matchVocation,
    parseFormula: parseFormula,
    importVocations: importVocations
  };
})();
