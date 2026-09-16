/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — UserController.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Controlador CRUD para a entidade Utilizadores. Opera na aba Users da planilha centralizada.
 *
 * FUNCIONALIDADES:
 *   • createUser(data) — Cria utilizador (create).
   • getAllUsers() — Lista todos (read).
   • getUserById(userId) — Busca por ID (read).
   • updateUser(userId, data) — Atualiza (update).
   • deactivateUser(userId) — Soft delete.
   • searchUsers(query) — Busca por nome/e-mail (read).
   • countUsers() — Total de utilizadores (read).
   • getUsersByRole(role) — Filtra por papel.
 *
 * INTEGRAÇÕES:
 *   • SpreadsheetApp — operações CRUD na aba Users.
   • RegisterService — validação de unicidade.
   • LoggerService — registro CRUD.
   • PermissionService — verificação admin.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const UserController = (function () {

  function _sanitizeUserData(user) {
    var sanitized = Utils.deepCopy(user);
    delete sanitized.Password;
    delete sanitized.PasswordUpdatedAt;
    delete sanitized._rowIndex;
    return sanitized;
  }

  function _logCRUD(action, userId, actorId) {
    try {
      if (typeof LoggerService !== 'undefined' && LoggerService.logCRUD) {
        LoggerService.logCRUD('Users', action, userId, actorId);
      }
    } catch (err) {
      // Auditoria é auxiliar
    }
  }

  function createUser(data) {
    try {
      var email = String(data.email || '').trim();
      var password = String(data.password || '');
      var fullName = String(data.fullName || '').trim();
      var role = String(data.role || 'user').toLowerCase();
      
      if (role === 'admin') {
        return RegisterService.registerAdmin(email, password, fullName);
      }
      return RegisterService.register(email, password, fullName);
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getAllUsers() {
    try {
      var result = Utils.getAllRows('Users');
      if (!result.success) return result;
      var sanitized = result.data.map(function(user) {
        return _sanitizeUserData(user);
      });
      return { success: true, data: sanitized, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function getUserById(userId) {
    try {
      var result = Utils.getAllRows('Users');
      if (!result.success) return result;
      var user = result.data.filter(function(u) {
        return u.UserID === userId;
      })[0];
      if (!user) {
        return { success: false, data: null, error: 'Utilizador não encontrado.' };
      }
      return { success: true, data: _sanitizeUserData(user), error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function updateUser(userId, data) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(10000);
      var sheet = Utils.getSheet('Users');
      if (!sheet) return { success: false, data: null, error: 'Aba Users não encontrada.' };
      
      var values = sheet.getDataRange().getValues();
      var headers = values[0] || [];
      var idCol = headers.indexOf('UserID');
      if (idCol === -1) return { success: false, data: null, error: 'Coluna UserID não encontrada.' };
      
      var rowIndex = -1;
      for (var i = 1; i < values.length; i++) {
        if (values[i][idCol] === userId) {
          rowIndex = i;
          break;
        }
      }
      if (rowIndex === -1) {
        return { success: false, data: null, error: 'Utilizador não encontrado.' };
      }
      
      var updatableFields = ['FullName', 'Status'];
      updatableFields.forEach(function(field) {
        var colIndex = headers.indexOf(field);
        if (colIndex !== -1 && data[field] !== undefined) {
          values[rowIndex][colIndex] = data[field];
        }
      });
      
      sheet.getRange(1, 1, values.length, headers.length).setValues(values);
      _logCRUD('UPDATE', userId, data.actorId || 'system');
      
      return { success: true, data: { userId: userId }, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      lock.releaseLock();
    }
  }

  function deactivateUser(userId) {
    return updateUser(userId, { Status: 'inactive', actorId: 'system' });
  }

  function searchUsers(query) {
    try {
      var result = getAllUsers();
      if (!result.success) return result;
      
      var q = String(query || '').toLowerCase().trim();
      if (!q) return result;
      
      var filtered = result.data.filter(function(user) {
        var name = String(user.FullName || '').toLowerCase();
        var email = String(user.Email || '').toLowerCase();
        return name.indexOf(q) !== -1 || email.indexOf(q) !== -1;
      });
      
      return { success: true, data: filtered, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function countUsers() {
    try {
      var result = Utils.getAllRows('Users');
      if (!result.success) return { success: false, data: 0, error: result.error };
      return { success: true, data: result.data.length, error: null };
    } catch (err) {
      return { success: false, data: 0, error: err.message };
    }
  }

  function getUsersByRole(role) {
    try {
      var result = getAllUsers();
      if (!result.success) return result;
      
      var filtered = result.data.filter(function(user) {
        return String(user.Role || '').toLowerCase() === String(role || '').toLowerCase();
      });
      
      return { success: true, data: filtered, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  return {
    createUser: createUser,
    getAllUsers: getAllUsers,
    getUserById: getUserById,
    updateUser: updateUser,
    deactivateUser: deactivateUser,
    searchUsers: searchUsers,
    countUsers: countUsers,
    getUsersByRole: getUsersByRole
  };
})();
