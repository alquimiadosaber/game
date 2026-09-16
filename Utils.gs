/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — Utils.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Biblioteca de funções utilitárias globais. Fornece helpers de formatação,
 *   manipulação de dados, geração de IDs únicos e operações comuns de
 *   array/object, além do acesso de baixo nível (batch) às abas da planilha
 *   central usada por todos os demais serviços.
 *
 * FUNCIONALIDADES:
 *   • generateId() — Gera UUID v4 via Utilities.getUuid().
 *   • getTimestamp() — Retorna timestamp ISO 8601.
 *   • formatDate(date) — Formata data dd/mm/yyyy.
 *   • sanitizeString(str) — Remove caracteres HTML perigosos.
 *   • batchRead(sheet, range) — Leitura em lote (sheet = nome ou objeto Sheet).
 *   • batchWrite(sheet, range, values) — Escrita em lote.
 *   • deepCopy(obj) — Clone profundo.
 *   • arrayToMap(arr, keyField) — Converte array em mapa.
 *   • chunkArray(arr, size) — Divide array em lotes.
 *   • getSheet(name) — Referência à aba por nome.
 *   • getAllRows(sheetName) — Lê aba como array de objetos.
 *   • addRow(sheetName, rowData) — Adiciona linha na aba (com lock).
 *
 * INTEGRAÇÕES:
 *   • SpreadsheetApp — operações em lote.
 *   • PropertiesService — acesso a SPREADSHEETS_ID.
 *   • LockService — evita corrupção em escritas concorrentes.
 *   • Utilities.getUuid() — geração de IDs.
 *
 * PADRÕES:
 *   Batch read/write — nunca célula a célula.
 *   Service result pattern — { success, data, error } nas funções de I/O.
 *   Helpers puros (generateId, formatDate, deepCopy, etc.) retornam o valor
 *   diretamente — envolvê-los em { success, data, error } seria ruído, pois
 *   não têm modo de falha significativo.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const Utils = (function () {

  function generateId() {
    return Utilities.getUuid();
  }

  function getTimestamp() {
    return new Date().toISOString();
  }

  function formatDate(date) {
    var d = date instanceof Date ? date : new Date(date);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }

  function sanitizeString(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function hashString(str) {
    // Hash simples para cache keys (não criptográfico)
    var hash = 0;
    var s = String(str || '');
    for (var i = 0; i < s.length; i++) {
      var char = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  function deepCopy(obj) {
    return obj === null || typeof obj !== 'object' ? obj : JSON.parse(JSON.stringify(obj));
  }

  function arrayToMap(arr, keyField) {
    var map = {};
    (arr || []).forEach(function (item) {
      map[item[keyField]] = item;
    });
    return map;
  }

  function chunkArray(arr, size) {
    var list = arr || [];
    var n = size > 0 ? size : (list.length || 1);
    var chunks = [];
    for (var i = 0; i < list.length; i += n) {
      chunks.push(list.slice(i, i + n));
    }
    return chunks;
  }

  // Abre a planilha central (SPREADSHEETS_ID) e devolve a aba pelo nome.
  // Falta de SPREADSHEETS_ID é erro de configuração fatal;
  // aba inexistente é condição esperada/recuperável (devolve null).
  function getSheet(name) {
    try {
      var spreadsheetId = '';
      try {
        spreadsheetId = String(PropertiesService.getDocumentProperties().getProperty('SPREADSHEETS_ID') || '').trim();
      } catch (documentPropertyError) {
        // Web Apps independentes podem não possuir propriedades de documento.
      }
      if (!spreadsheetId) {
        spreadsheetId = String(PropertiesService.getScriptProperties().getProperty('SPREADSHEETS_ID') || '').trim();
      }
      if (!spreadsheetId) {
        spreadsheetId = String(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '').trim();
      }
      if (!spreadsheetId) {
        // Retorna null para ser tratado pelos chamadores como erro recuperável
        if (typeof Logger !== 'undefined') {
          Logger.log('[Utils.getSheet] ERRO DE CONFIGURAÇÃO: SPREADSHEETS_ID não configurado');
        }
        return null;
      }
      var ss = SpreadsheetApp.openById(spreadsheetId);
      return ss.getSheetByName(name) || null;
    } catch (err) {
      if (typeof Logger !== 'undefined') {
        Logger.log('[Utils.getSheet] Erro ao abrir planilha: ' + err.message);
      }
      return null;
    }
  }

  function batchRead(sheet, range) {
    try {
      var sh = typeof sheet === 'string' ? getSheet(sheet) : sheet;
      if (!sh) return { success: false, data: null, error: 'Dados não disponíveis no momento.' };
      var values = range ? sh.getRange(range).getValues() : sh.getDataRange().getValues();
      return { success: true, data: values, error: null };
    } catch (err) {
      return { success: false, data: null, error: 'Erro ao acessar dados. Tente novamente.' };
    }
  }

  function batchWrite(sheet, range, values) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sh = typeof sheet === 'string' ? getSheet(sheet) : sheet;
      if (!sh) return { success: false, data: null, error: 'Dados não disponíveis no momento.' };
      if (!values || !values.length) return { success: true, data: 0, error: null };
      var targetRange = range ? sh.getRange(range) : sh.getRange(1, 1, values.length, values[0].length);
      targetRange.setValues(values);
      return { success: true, data: values.length, error: null };
    } catch (err) {
      return { success: false, data: null, error: 'Erro ao salvar dados. Tente novamente.' };
    } finally {
      lock.releaseLock();
    }
  }

  function getAllRows(sheetName) {
    try {
      var sheet = getSheet(sheetName);
      if (!sheet) return { success: false, data: [], error: 'Dados não disponíveis no momento.' };
      var values = sheet.getDataRange().getValues();
      if (values.length < 2) return { success: true, data: [], error: null };
      var headers = values[0];
      var rows = [];
      for (var i = 1; i < values.length; i++) {
        var row = values[i];
        var obj = { _rowIndex: i + 1 }; // linha real na planilha (1-based), útil para updates pontuais
        for (var c = 0; c < headers.length; c++) {
          obj[headers[c]] = row[c];
        }
        rows.push(obj);
      }
      return { success: true, data: rows, error: null };
    } catch (err) {
      return { success: false, data: [], error: 'Erro ao carregar dados. Tente novamente.' };
    }
  }

  function addRow(sheetName, rowData) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = getSheet(sheetName);
      if (!sheet) return { success: false, data: null, error: 'Dados não disponíveis no momento.' };
      var headers = sheet.getDataRange().getValues()[0] || [];
      if (!headers.length) return { success: false, data: null, error: 'Configuração de dados inválida.' };
      var row = headers.map(function (h) {
        return Object.prototype.hasOwnProperty.call(rowData, h) ? rowData[h] : '';
      });
      sheet.appendRow(row);
      return { success: true, data: rowData, error: null };
    } catch (err) {
      return { success: false, data: null, error: 'Erro ao salvar dados. Tente novamente.' };
    } finally {
      lock.releaseLock();
    }
  }

  return {
    generateId: generateId,
    getTimestamp: getTimestamp,
    formatDate: formatDate,
    sanitizeString: sanitizeString,
    hashString: hashString,
    batchRead: batchRead,
    batchWrite: batchWrite,
    deepCopy: deepCopy,
    arrayToMap: arrayToMap,
    chunkArray: chunkArray,
    getSheet: getSheet,
    getAllRows: getAllRows,
    addRow: addRow
  };
})();
