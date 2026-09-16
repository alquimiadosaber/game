/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — NotificationService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Notificações por e-mail via MailApp. Envia notificações sobre conquistas,
 *   resultados, lembretes e comunicações administrativas com templates HTML.
 *
 * FUNCIONALIDADES:
 *   • sendAchievementNotification(userId, achievement) — Notificação de conquista.
 *   • sendResultNotification(userId, resultId) — Notificação de resultado.
 *   • sendSessionReminder(userId) — Lembrete de sessão.
 *   • sendWelcomeEmail(email, name) — E-mail de boas-vindas.
 *   • sendAdminAlert(message) — Alerta para administrador.
 *   • sendBulkNotification(userIds, subject, body) — Notificação em massa.
 *   • sendPasswordReset(email, temporaryPassword) — E-mail de recuperação.
 *   • getNotificationHistory(userId) — Histórico de notificações enviadas.
 *
 * INTEGRAÇÕES:
 *   • MailApp — envio de e-mails nativo GAS.
 *   • UserController — dados do utilizador.
 *   • GamificationService — dados de conquistas.
 *   • ResultService — dados de resultados.
 *   • ConfigService — email do administrador, limites.
 *   • LoggerService — registro de envios.
 *
 * RATE LIMITING:
 *   Google Apps Script limita envio de emails:
 *   - Conta gratuita: 100 emails/dia
 *   - Google Workspace: 1500 emails/dia
 *   Este serviço implementa controle básico via PropertiesService.
 *
 * PADRÕES:
 *   Template-based — e-mails com templates HTML.
 *   Service result pattern — { success, data, error }.
 *   Rate limiting — controle de quota diária.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const NotificationService = (function () {

  var APP_NAME = 'Alquimia do Saber';
  var DAILY_EMAIL_LIMIT = 100; // Ajustar conforme tipo de conta
  var RATE_LIMIT_KEY = 'email_count_';

  function _getTodayKey() {
    return RATE_LIMIT_KEY + Utilities.formatDate(new Date(), 'GMT', 'yyyy-MM-dd');
  }

  function _incrementEmailCount() {
    try {
      var key = _getTodayKey();
      var props = PropertiesService.getScriptProperties();
      var current = parseInt(props.getProperty(key) || '0', 10);
      props.setProperty(key, String(current + 1));
      return current + 1;
    } catch (err) {
      return 0;
    }
  }

  function _checkRateLimit() {
    try {
      var key = _getTodayKey();
      var props = PropertiesService.getScriptProperties();
      var current = parseInt(props.getProperty(key) || '0', 10);
      return current < DAILY_EMAIL_LIMIT;
    } catch (err) {
      return true; // Em caso de erro, permite envio
    }
  }

  function _getAdminEmail() {
    try {
      if (typeof ConfigService !== 'undefined' && ConfigService.get) {
        var email = ConfigService.get('ADMIN_EMAIL');
        if (email) return email;
      }
    } catch (err) {
      // Continua com fallback
    }
    return Session.getEffectiveUser().getEmail();
  }

  function _getUserEmail(userId) {
    try {
      if (typeof UserController !== 'undefined' && UserController.getUserById) {
        var result = UserController.getUserById(userId);
        if (result.success && result.data) {
          return result.data.Email;
        }
      }
    } catch (err) {
      // Retorna null em caso de erro
    }
    return null;
  }

  function _logNotification(userId, type, success) {
    try {
      if (typeof LoggerService !== 'undefined' && LoggerService.log) {
        LoggerService.log('NOTIFICATION', type, 'UserId: ' + userId + ', Success: ' + success);
      }
    } catch (err) {
      // Log é auxiliar
    }
  }

  function _buildHtmlTemplate(title, body) {
    return '<html><body style="font-family:Arial,sans-serif;color:#333;max-width:600px;margin:0 auto;">' +
      '<div style="background:#8B4513;color:white;padding:20px;text-align:center;">' +
      '<h1 style="margin:0;">🧪 ' + APP_NAME + '</h1>' +
      '</div>' +
      '<div style="padding:20px;background:#f9f9f9;">' +
      '<h2 style="color:#8B4513;">' + title + '</h2>' +
      '<div style="background:white;padding:15px;border-left:4px solid #8B4513;">' +
      body +
      '</div>' +
      '</div>' +
      '<div style="padding:20px;text-align:center;font-size:12px;color:#666;">' +
      '<p>Este é um e-mail automático. Por favor, não responda.</p>' +
      '<p>&copy; 2026 Alquimia do Saber</p>' +
      '</div>' +
      '</body></html>';
  }

  function sendWelcomeEmail(email, name) {
    if (!email) return { success: false, data: null, error: 'Email é obrigatório.' };
    
    try {
      if (!_checkRateLimit()) {
        return { success: false, data: null, error: 'Limite diário de emails atingido.' };
      }

      var userName = name || 'Alquimista';
      var subject = 'Bem-vindo ao ' + APP_NAME + '!';
      
      var body = '<p>Olá, <strong>' + userName + '</strong>!</p>' +
        '<p>Bem-vindo ao <strong>Alquimia do Saber</strong>, onde você explorará dilemas éticos através de simulações interativas.</p>' +
        '<p>🧪 Prepare seu caldeirão epistémico e comece a experimentar!</p>' +
        '<p><strong>Próximos passos:</strong></p>' +
        '<ul>' +
        '<li>Complete seu perfil</li>' +
        '<li>Explore os cenários disponíveis</li>' +
        '<li>Crie sua primeira poção (mistura FIL + PSI + IA)</li>' +
        '</ul>' +
        '<p>Bons estudos!</p>';
      
      var htmlBody = _buildHtmlTemplate('Bem-vindo!', body);
      
      MailApp.sendEmail({
        to: email,
        subject: subject,
        htmlBody: htmlBody
      });
      
      _incrementEmailCount();
      _logNotification(email, 'WELCOME', true);
      
      return { success: true, data: { email: email, sent: true }, error: null };
    } catch (err) {
      _logNotification(email, 'WELCOME', false);
      return { success: false, data: null, error: err.message };
    }
  }

  function sendAchievementNotification(userId, achievement) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    if (!achievement) return { success: false, data: null, error: 'Achievement é obrigatório.' };
    
    try {
      if (!_checkRateLimit()) {
        return { success: false, data: null, error: 'Limite diário de emails atingido.' };
      }

      var email = _getUserEmail(userId);
      if (!email) return { success: false, data: null, error: 'Email do utilizador não encontrado.' };
      
      var achievementName = achievement.name || achievement.Name || 'Nova Conquista';
      var achievementDesc = achievement.description || achievement.Description || '';
      
      var subject = '🏆 Nova Conquista Desbloqueada!';
      
      var body = '<p>Parabéns! Você desbloqueou uma nova conquista:</p>' +
        '<div style="text-align:center;margin:20px 0;">' +
        '<h3 style="color:#FFD700;font-size:24px;">🏆 ' + achievementName + '</h3>' +
        '<p style="font-style:italic;color:#666;">' + achievementDesc + '</p>' +
        '</div>' +
        '<p>Continue experimentando e desbloqueie mais conquistas!</p>';
      
      var htmlBody = _buildHtmlTemplate('Nova Conquista!', body);
      
      MailApp.sendEmail({
        to: email,
        subject: subject,
        htmlBody: htmlBody
      });
      
      _incrementEmailCount();
      _logNotification(userId, 'ACHIEVEMENT', true);
      
      return { success: true, data: { userId: userId, email: email, sent: true }, error: null };
    } catch (err) {
      _logNotification(userId, 'ACHIEVEMENT', false);
      return { success: false, data: null, error: err.message };
    }
  }

  function sendResultNotification(userId, resultId) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    if (!resultId) return { success: false, data: null, error: 'ResultID é obrigatório.' };
    
    try {
      if (!_checkRateLimit()) {
        return { success: false, data: null, error: 'Limite diário de emails atingido.' };
      }

      var email = _getUserEmail(userId);
      if (!email) return { success: false, data: null, error: 'Email do utilizador não encontrado.' };
      
      var subject = '📊 Seus Resultados Estão Prontos!';
      
      var body = '<p>Seus resultados foram processados com sucesso!</p>' +
        '<p><strong>ID do Resultado:</strong> ' + resultId + '</p>' +
        '<p>Acesse a plataforma para visualizar:</p>' +
        '<ul>' +
        '<li>Análise completa da sua poção</li>' +
        '<li>Pontuação TRI</li>' +
        '<li>Atualização dos seus vectores psicométricos</li>' +
        '<li>Recomendações vocacionais</li>' +
        '</ul>' +
        '<p>Continue experimentando novos cenários!</p>';
      
      var htmlBody = _buildHtmlTemplate('Resultados Prontos', body);
      
      MailApp.sendEmail({
        to: email,
        subject: subject,
        htmlBody: htmlBody
      });
      
      _incrementEmailCount();
      _logNotification(userId, 'RESULT', true);
      
      return { success: true, data: { userId: userId, email: email, resultId: resultId, sent: true }, error: null };
    } catch (err) {
      _logNotification(userId, 'RESULT', false);
      return { success: false, data: null, error: err.message };
    }
  }

  function sendSessionReminder(userId) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    
    try {
      if (!_checkRateLimit()) {
        return { success: false, data: null, error: 'Limite diário de emails atingido.' };
      }

      var email = _getUserEmail(userId);
      if (!email) return { success: false, data: null, error: 'Email do utilizador não encontrado.' };
      
      var subject = '⏰ Lembrete: Continue Sua Jornada!';
      
      var body = '<p>Olá! Sentimos sua falta no Alquimia do Saber.</p>' +
        '<p>Há novos cenários esperando por você:</p>' +
        '<ul>' +
        '<li>🤖 Dilemas de Inteligência Artificial</li>' +
        '<li>🧠 Questões de Neurociência</li>' +
        '<li>🌍 Desafios Sociais</li>' +
        '</ul>' +
        '<p>Volte e continue desenvolvendo suas habilidades de pensamento crítico!</p>';
      
      var htmlBody = _buildHtmlTemplate('Sentimos Sua Falta', body);
      
      MailApp.sendEmail({
        to: email,
        subject: subject,
        htmlBody: htmlBody
      });
      
      _incrementEmailCount();
      _logNotification(userId, 'REMINDER', true);
      
      return { success: true, data: { userId: userId, email: email, sent: true }, error: null };
    } catch (err) {
      _logNotification(userId, 'REMINDER', false);
      return { success: false, data: null, error: err.message };
    }
  }

  function sendPasswordReset(email, temporaryPassword) {
    if (!email) return { success: false, data: null, error: 'Email é obrigatório.' };
    if (!temporaryPassword) return { success: false, data: null, error: 'Senha temporária é obrigatória.' };
    
    try {
      if (!_checkRateLimit()) {
        return { success: false, data: null, error: 'Limite diário de emails atingido.' };
      }

      var subject = '🔑 Redefinição de Senha';
      
      var body = '<p>Você solicitou a redefinição de sua senha.</p>' +
        '<p><strong>Sua senha temporária é:</strong></p>' +
        '<div style="background:#f0f0f0;padding:15px;text-align:center;font-size:20px;font-family:monospace;letter-spacing:2px;border-radius:5px;">' +
        temporaryPassword +
        '</div>' +
        '<p><strong>⚠️ Importante:</strong></p>' +
        '<ul>' +
        '<li>Esta senha é temporária</li>' +
        '<li>Altere-a após o primeiro login</li>' +
        '<li>Não compartilhe com ninguém</li>' +
        '</ul>' +
        '<p>Se você não solicitou esta redefinição, ignore este email.</p>';
      
      var htmlBody = _buildHtmlTemplate('Redefinição de Senha', body);
      
      MailApp.sendEmail({
        to: email,
        subject: subject,
        htmlBody: htmlBody
      });
      
      _incrementEmailCount();
      _logNotification(email, 'PASSWORD_RESET', true);
      
      return { success: true, data: { email: email, sent: true }, error: null };
    } catch (err) {
      _logNotification(email, 'PASSWORD_RESET', false);
      return { success: false, data: null, error: err.message };
    }
  }

  function sendAdminAlert(message) {
    if (!message) return { success: false, data: null, error: 'Mensagem é obrigatória.' };
    
    try {
      if (!_checkRateLimit()) {
        return { success: false, data: null, error: 'Limite diário de emails atingido.' };
      }

      var adminEmail = _getAdminEmail();
      var subject = '⚠️ Alerta Administrativo - ' + APP_NAME;
      
      var body = '<p><strong>Alerta do sistema:</strong></p>' +
        '<div style="background:#fff3cd;border-left:4px solid #ff9800;padding:15px;margin:15px 0;">' +
        '<p>' + String(message).replace(/\n/g, '<br>') + '</p>' +
        '</div>' +
        '<p><strong>Timestamp:</strong> ' + new Date().toISOString() + '</p>' +
        '<p>Verifique o sistema se necessário.</p>';
      
      var htmlBody = _buildHtmlTemplate('Alerta Administrativo', body);
      
      MailApp.sendEmail({
        to: adminEmail,
        subject: subject,
        htmlBody: htmlBody
      });
      
      _incrementEmailCount();
      _logNotification('ADMIN', 'ALERT', true);
      
      return { success: true, data: { admin: adminEmail, sent: true }, error: null };
    } catch (err) {
      _logNotification('ADMIN', 'ALERT', false);
      return { success: false, data: null, error: err.message };
    }
  }

  function sendBulkNotification(userIds, subject, body) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return { success: false, data: null, error: 'UserIDs deve ser array não vazio.' };
    }
    if (!subject || !body) {
      return { success: false, data: null, error: 'Subject e body são obrigatórios.' };
    }
    
    try {
      var sent = 0;
      var failed = 0;
      var errors = [];
      
      userIds.forEach(function(userId) {
        if (!_checkRateLimit()) {
          errors.push({ userId: userId, error: 'Limite diário atingido' });
          failed++;
          return;
        }
        
        var email = _getUserEmail(userId);
        if (!email) {
          errors.push({ userId: userId, error: 'Email não encontrado' });
          failed++;
          return;
        }
        
        try {
          var htmlBody = _buildHtmlTemplate(subject, body);
          
          MailApp.sendEmail({
            to: email,
            subject: subject,
            htmlBody: htmlBody
          });
          
          _incrementEmailCount();
          sent++;
        } catch (err) {
          errors.push({ userId: userId, error: err.message });
          failed++;
        }
      });
      
      _logNotification('BULK', 'NOTIFICATION', sent > 0);
      
      return {
        success: sent > 0,
        data: {
          sent: sent,
          failed: failed,
          total: userIds.length,
          errors: errors
        },
        error: failed === userIds.length ? 'Nenhum email foi enviado com sucesso.' : null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getNotificationHistory(userId) {
    if (!userId) return { success: false, data: null, error: 'UserID é obrigatório.' };
    
    try {
      // Busca histórico de logs de notificações
      if (typeof LoggerService !== 'undefined' && LoggerService.getLogs) {
        var logsResult = LoggerService.getLogs({
          level: 'NOTIFICATION',
          message: userId
        });
        
        if (logsResult.success) {
          return { success: true, data: logsResult.data, error: null };
        }
      }
      
      // Fallback: retorna vazio se LoggerService não disponível
      return { success: true, data: [], error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    sendWelcomeEmail: sendWelcomeEmail,
    sendAchievementNotification: sendAchievementNotification,
    sendResultNotification: sendResultNotification,
    sendSessionReminder: sendSessionReminder,
    sendPasswordReset: sendPasswordReset,
    sendAdminAlert: sendAdminAlert,
    sendBulkNotification: sendBulkNotification,
    getNotificationHistory: getNotificationHistory
  };
})();
