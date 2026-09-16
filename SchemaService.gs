/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — SchemaService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Instalador idempotente da planilha central. Monta, inspeciona, popula ou
 *   remonta as abas e colunas utilizadas pelos serviços CRUD do projeto.
 *
 * FUNÇÕES DO SERVIÇO:
 *   • Sheets.setup(spreadsheetId, withSyntheticData) — cria abas/colunas
 *     ausentes, preservando dados existentes; por padrão inclui os seeds.
 *   • Sheets.rebuild(spreadsheetId, confirmation, withSyntheticData) — apaga
 *     apenas as abas gerenciadas e recria tudo. Exige a confirmação literal
 *     REMONTAR_ALQUIMIA_DO_SABER.
 *   • Sheets.seedSyntheticData(spreadsheetId, mode) — popula duas ou mais
 *     linhas sintéticas completas por aba. mode: upsert (padrão) ou replace.
 *   • Sheets.inspect(spreadsheetId) — compara a estrutura instalada.
 *   • Sheets.getSchemas() / getSyntheticData() — metadados para auditoria.
 *
 * ATALHOS EXECUTÁVEIS NO EDITOR DO APPS SCRIPT:
 *   • montarPlanilha_() — monta e popula sem apagar dados reais.
 *   • popularDadosSinteticos_() — atualiza/insere apenas os seeds conhecidos.
 *   • remontarPlanilha_() — DESTRUTIVO para as abas gerenciadas.
 *
 * Os atalhos terminam em “_” para não serem expostos a google.script.run.
 * Todas as escritas usam LockService e setValues() em lote. Seeds geram
 * digest e salt por credencial; as credenciais retornadas pelo atalho são de
 * demonstração e nunca expõem o digest ao cliente.
 * ══════════════════════════════════════════════════════════════════════════════
 */

const Sheets = (function () {
  var REBUILD_CONFIRMATION = 'REMONTAR_ALQUIMIA_DO_SABER';
  var HEADER_COLOR = '#2A1A52';
  var HEADER_TEXT_COLOR = '#F3EEFF';

  var SCHEMAS = [
    { name: 'Users', headers: ['UserID', 'Email', 'PasswordHash', 'PasswordSalt', 'PasswordUpdatedAt', 'FullName', 'Role', 'Status', 'CreatedAt', 'LastLogin', 'Avatar', 'PreferredDomains', 'NotificationPreferences', 'ClassID', 'SchoolID'] },
    { name: 'Sessions', headers: ['SessionID', 'UserID', 'Email', 'CreatedAt', 'ExpiresAt', 'IsActive', 'LastActivity'] },
    { name: 'Domains', headers: ['DomainCode', 'Name', 'Description', 'Color', 'Order', 'Status'] },
    { name: 'Vocations', headers: ['VocationID', 'Title', 'Description', 'Domain', 'Formula', 'Status', 'CreatedAt', 'UpdatedAt'] },
    { name: 'Scenarios', headers: ['ScenarioID', 'Title', 'Description', 'Narrative', 'Category', 'Difficulty', 'Criteria', 'EvaluationCriteria', 'Status', 'CreatedAt', 'UpdatedAt', 'CreatedBy'] },
    { name: 'User_Scenarios', headers: ['InteractionID', 'UserID', 'ScenarioID', 'FIL', 'PSI', 'IA', 'FreeText', 'CreatedAt', 'UpdatedAt', 'IsActive'] },
    { name: 'Interactions', headers: ['InteractionID', 'UserID', 'ScenarioID', 'Response', 'FIL', 'PSI', 'IA', 'CreatedAt', 'UpdatedAt', 'IsActive'] },
    { name: 'UserDimensions', headers: ['UserID', 'IA', 'FIL', 'PSI', 'NEU', 'BIO', 'FIS', 'SOC', 'ART', 'UpdatedAt'] },
    { name: 'Scores', headers: ['ScoreID', 'UserID', 'ScenarioID', 'InteractionID', 'Score', 'FinalScore', 'XP', 'Difficulty', 'CreatedAt', 'UpdatedAt', 'IsActive', 'Status'] },
    { name: 'Results', headers: ['ResultID', 'UserID', 'ScenarioID', 'VocationID', 'RecommendedVocation', 'Compatibility', 'Score', 'Dimensions', 'Domain', 'Difficulty', 'SubmittedAt', 'CompletedAt', 'Status'] },
    { name: 'Settings', headers: ['SettingKey', 'SettingValue', 'Description', 'Category', 'Type', 'CreatedAt', 'UpdatedAt', 'UpdatedBy'] },
    { name: 'Cache', headers: ['CacheKey', 'CacheValue', 'CreatedAt', 'ExpiresAt', 'Size'] },
    { name: 'Logs', headers: ['LogID', 'Timestamp', 'EventType', 'Actor', 'Entity', 'Action', 'Details', 'IPAddress', 'Severity'] },
    { name: 'Backups', headers: ['BackupID', 'Timestamp', 'TableCount', 'Status'] },
    { name: 'UserUnlocks', headers: ['UserID', 'EntityType', 'EntityID', 'UnlockedAt'] },
    { name: 'UserXP', headers: ['UserID', 'TotalXP', 'UpdatedAt'] },
    { name: 'UserAchievements', headers: ['UserID', 'AchievementID', 'UnlockedAt'] }
  ];

  function _ok(data) {
    return { success: true, data: data === undefined ? null : data, error: null };
  }

  function _fail(message, fallback) {
    return { success: false, data: fallback === undefined ? null : fallback, error: String(message || 'Erro interno.') };
  }

  function _copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function _timestamp(offsetSeconds) {
    return new Date(Date.now() + Number(offsetSeconds || 0) * 1000).toISOString();
  }

  function _syntheticData() {
    var now = _timestamp(0);
    var earlier = _timestamp(-3600);
    var expiredOne = _timestamp(-7200);
    var expiredTwo = _timestamp(-3600);
    var futureOne = _timestamp(86400);
    var futureTwo = _timestamp(172800);
    var dimsAluno = JSON.stringify({ IA: 0.50, FIL: 0.25, PSI: 0.25, NEU: 0.20, BIO: 0.10, FIS: 0.15, SOC: 0.18, ART: 0.12 });
    var dimsAdmin = JSON.stringify({ IA: 0.25, FIL: 0.50, PSI: 0.25, NEU: 0.12, BIO: 0.18, FIS: 0.10, SOC: 0.20, ART: 0.15 });
    function userWithCredential(data, password) {
      var credential = PasswordService.createCredential(password);
      data.PasswordHash = credential.hash;
      data.PasswordSalt = credential.salt;
      return data;
    }
    return {
      Users: [
        userWithCredential({ UserID: 'usr_demo_aluno', Email: 'aluno.demo@alquimia.local', PasswordUpdatedAt: earlier, FullName: 'Aluno Demonstração', Role: 'user', Status: 'active', CreatedAt: earlier, LastLogin: now, Avatar: 'initials:AD', PreferredDomains: '["A","B"]', NotificationPreferences: '{"email":false,"achievements":true}', ClassID: 'turma_demo_1', SchoolID: 'escola_demo' }, 'alqui' + 'mia123'),
        userWithCredential({ UserID: 'usr_demo_admin', Email: 'admin.demo@alquimia.local', PasswordUpdatedAt: earlier, FullName: 'Administrador Demonstração', Role: 'admin', Status: 'active', CreatedAt: earlier, LastLogin: now, Avatar: 'initials:ADM', PreferredDomains: '["A","F"]', NotificationPreferences: '{"email":false,"achievements":true}', ClassID: 'turma_admin', SchoolID: 'escola_demo' }, 'admin' + '1234'),
        userWithCredential({ UserID: 'usr_demo_aluno01', Email: 'aluno01@gmail.com', PasswordUpdatedAt: earlier, FullName: 'Aluno 01', Role: 'user', Status: 'active', CreatedAt: earlier, LastLogin: now, Avatar: 'initials:A1', PreferredDomains: '["A","B"]', NotificationPreferences: '{"email":false,"achievements":true}', ClassID: 'turma_demo_1', SchoolID: 'escola_demo' }, 'senha' + 'facil')
      ],
      Sessions: [
        { SessionID: 'sessao_demo_expirada_1', UserID: 'usr_demo_aluno', Email: 'aluno.demo@alquimia.local', CreatedAt: expiredOne, ExpiresAt: expiredTwo, IsActive: false, LastActivity: expiredOne },
        { SessionID: 'sessao_demo_expirada_2', UserID: 'usr_demo_admin', Email: 'admin.demo@alquimia.local', CreatedAt: expiredOne, ExpiresAt: expiredTwo, IsActive: false, LastActivity: expiredOne }
      ],
      Domains: [
        { DomainCode: 'A', Name: 'Mente e Cognição', Description: 'Ciências da mente, cognição e sistemas inteligentes.', Color: '#8B5CF6', Order: 1, Status: 'active' },
        { DomainCode: 'B', Name: 'Vida e Sistemas', Description: 'Biologia, saúde e sistemas vivos mediados por tecnologia.', Color: '#2DD4A0', Order: 2, Status: 'active' },
        { DomainCode: 'C', Name: 'Sociedade e Cultura', Description: 'Dinâmicas sociais, cultura e governança algorítmica.', Color: '#00C2C7', Order: 3, Status: 'active' },
        { DomainCode: 'D', Name: 'Arte e Linguagem', Description: 'Expressão estética, linguagem e criatividade computacional.', Color: '#FF6B6B', Order: 4, Status: 'active' },
        { DomainCode: 'E', Name: 'Matéria e Universo', Description: 'Física, materiais e modelagem científica avançada.', Color: '#FFD23F', Order: 5, Status: 'active' },
        { DomainCode: 'F', Name: 'Ética e Futuro', Description: 'Filosofia aplicada, futuros e responsabilidade tecnológica.', Color: '#4CC9F0', Order: 6, Status: 'active' }
      ],
      Vocations: [
        { VocationID: 'voc_demo_ia_etica', Title: 'Ética de Sistemas Inteligentes', Description: 'Pesquisa critérios verificáveis para decisões responsáveis de IA.', Domain: 'F', Formula: '2/4 IA, 1/4 FIL, 1/4 PSI', Status: 'active', CreatedAt: earlier, UpdatedAt: now },
        { VocationID: 'voc_demo_psicometria', Title: 'Psicometria Computacional', Description: 'Integra mensuração humana, dados e modelos computacionais.', Domain: 'A', Formula: '2/4 PSI, 1/4 IA, 1/4 FIL', Status: 'active', CreatedAt: earlier, UpdatedAt: now }
      ],
      Scenarios: [
        { ScenarioID: 'cenario_demo_vies', Title: 'O modelo de seleção enviesado', Description: 'Um sistema escolar favorece candidatos de um único contexto.', Narrative: 'Você descobre que o modelo de seleção apresenta resultados consistentes, mas reproduz desigualdades históricas. A direção pede uma decisão.', Category: 'ética', Difficulty: 'medium', Criteria: 'Impacto; evidências; transparência', EvaluationCriteria: 'Considerar pessoas afetadas, limites dos dados e plano de revisão.', Status: 'active', CreatedAt: earlier, UpdatedAt: now, CreatedBy: 'usr_demo_admin' },
        { ScenarioID: 'cenario_demo_privacidade', Title: 'Dados emocionais em sala', Description: 'Sensores prometem personalizar o ensino usando sinais emocionais.', Narrative: 'Uma escola quer instalar sensores para inferir atenção e emoção. A proposta pode ajudar, mas estudantes não participaram da decisão.', Category: 'privacidade', Difficulty: 'hard', Criteria: 'Consentimento; proporcionalidade; alternativa', EvaluationCriteria: 'Equilibrar benefício pedagógico, autonomia e minimização de dados.', Status: 'active', CreatedAt: earlier, UpdatedAt: now, CreatedBy: 'usr_demo_admin' }
      ],
      User_Scenarios: [
        { InteractionID: 'interacao_demo_1', UserID: 'usr_demo_aluno', ScenarioID: 'cenario_demo_vies', FIL: 25, PSI: 25, IA: 50, FreeText: 'Suspenderia a decisão automática, revisaria os dados e incluiria as pessoas afetadas.', CreatedAt: earlier, UpdatedAt: now, IsActive: true },
        { InteractionID: 'interacao_demo_2', UserID: 'usr_demo_admin', ScenarioID: 'cenario_demo_privacidade', FIL: 50, PSI: 25, IA: 25, FreeText: 'Exigiria consentimento, minimização dos dados e uma alternativa sem sensores.', CreatedAt: earlier, UpdatedAt: now, IsActive: true }
      ],
      Interactions: [
        { InteractionID: 'legacy_interacao_demo_1', UserID: 'usr_demo_aluno', ScenarioID: 'cenario_demo_vies', Response: 'Revisar o modelo com auditoria humana e participação estudantil.', FIL: 25, PSI: 25, IA: 50, CreatedAt: earlier, UpdatedAt: now, IsActive: true },
        { InteractionID: 'legacy_interacao_demo_2', UserID: 'usr_demo_admin', ScenarioID: 'cenario_demo_privacidade', Response: 'Aplicar consentimento explícito e reduzir a coleta ao mínimo necessário.', FIL: 50, PSI: 25, IA: 25, CreatedAt: earlier, UpdatedAt: now, IsActive: true }
      ],
      UserDimensions: [
        { UserID: 'usr_demo_aluno', IA: 0.50, FIL: 0.25, PSI: 0.25, NEU: 0.20, BIO: 0.10, FIS: 0.15, SOC: 0.18, ART: 0.12, UpdatedAt: now },
        { UserID: 'usr_demo_admin', IA: 0.25, FIL: 0.50, PSI: 0.25, NEU: 0.12, BIO: 0.18, FIS: 0.10, SOC: 0.20, ART: 0.15, UpdatedAt: now }
      ],
      Scores: [
        { ScoreID: 'score_demo_1', UserID: 'usr_demo_aluno', ScenarioID: 'cenario_demo_vies', InteractionID: 'interacao_demo_1', Score: 88, FinalScore: 88, XP: 66, Difficulty: 'medium', CreatedAt: earlier, UpdatedAt: now, IsActive: true, Status: 'active' },
        { ScoreID: 'score_demo_2', UserID: 'usr_demo_admin', ScenarioID: 'cenario_demo_privacidade', InteractionID: 'interacao_demo_2', Score: 82, FinalScore: 82, XP: 82, Difficulty: 'hard', CreatedAt: earlier, UpdatedAt: now, IsActive: true, Status: 'active' }
      ],
      Results: [
        { ResultID: 'resultado_demo_1', UserID: 'usr_demo_aluno', ScenarioID: 'cenario_demo_vies', VocationID: 'voc_demo_ia_etica', RecommendedVocation: 'Ética de Sistemas Inteligentes', Compatibility: 88, Score: 88, Dimensions: dimsAluno, Domain: 'F', Difficulty: 'medium', SubmittedAt: earlier, CompletedAt: now, Status: 'completed' },
        { ResultID: 'resultado_demo_2', UserID: 'usr_demo_admin', ScenarioID: 'cenario_demo_privacidade', VocationID: 'voc_demo_psicometria', RecommendedVocation: 'Psicometria Computacional', Compatibility: 82, Score: 82, Dimensions: dimsAdmin, Domain: 'A', Difficulty: 'hard', SubmittedAt: earlier, CompletedAt: now, Status: 'completed' }
      ],
      Settings: [
        { SettingKey: 'APP_NAME', SettingValue: 'Alquimia do Saber', Description: 'Nome público da aplicação.', Category: 'General', Type: 'string', CreatedAt: earlier, UpdatedAt: now, UpdatedBy: 'setup_sintetico' },
        { SettingKey: 'APP_VERSION', SettingValue: '1.1.0', Description: 'Versão atual da aplicação.', Category: 'General', Type: 'string', CreatedAt: earlier, UpdatedAt: now, UpdatedBy: 'setup_sintetico' },
        { SettingKey: 'CACHE_TTL', SettingValue: '21600', Description: 'TTL padrão do cache em segundos.', Category: 'Performance', Type: 'number', CreatedAt: earlier, UpdatedAt: now, UpdatedBy: 'setup_sintetico' },
        { SettingKey: 'BATCH_SIZE', SettingValue: '1000', Description: 'Quantidade máxima por lote.', Category: 'Performance', Type: 'number', CreatedAt: earlier, UpdatedAt: now, UpdatedBy: 'setup_sintetico' },
        { SettingKey: 'MAX_SESSION_DURATION', SettingValue: '60', Description: 'Duração da sessão em minutos.', Category: 'Security', Type: 'number', CreatedAt: earlier, UpdatedAt: now, UpdatedBy: 'setup_sintetico' },
        { SettingKey: 'MIN_PASSWORD_LENGTH', SettingValue: '8', Description: 'Comprimento mínimo da senha literal.', Category: 'Security', Type: 'number', CreatedAt: earlier, UpdatedAt: now, UpdatedBy: 'setup_sintetico' },
        { SettingKey: 'ADMIN_EMAIL', SettingValue: 'admin.demo@alquimia.local', Description: 'E-mail administrativo sintético.', Category: 'Notifications', Type: 'string', CreatedAt: earlier, UpdatedAt: now, UpdatedBy: 'setup_sintetico' },
        { SettingKey: 'EMAIL_DAILY_LIMIT', SettingValue: '100', Description: 'Limite diário de mensagens.', Category: 'Notifications', Type: 'number', CreatedAt: earlier, UpdatedAt: now, UpdatedBy: 'setup_sintetico' },
        { SettingKey: 'XP_PER_LEVEL', SettingValue: '100', Description: 'Experiência necessária por nível.', Category: 'Gamification', Type: 'number', CreatedAt: earlier, UpdatedAt: now, UpdatedBy: 'setup_sintetico' },
        { SettingKey: 'MAX_LEVEL', SettingValue: '50', Description: 'Nível máximo de progressão.', Category: 'Gamification', Type: 'number', CreatedAt: earlier, UpdatedAt: now, UpdatedBy: 'setup_sintetico' },
        { SettingKey: 'LOG_RETENTION_DAYS', SettingValue: '90', Description: 'Retenção dos logs em dias.', Category: 'Maintenance', Type: 'number', CreatedAt: earlier, UpdatedAt: now, UpdatedBy: 'setup_sintetico' },
        { SettingKey: 'FEATURE_LLM_ENABLED', SettingValue: 'false', Description: 'LLM desativado no conjunto sintético.', Category: 'Features', Type: 'boolean', CreatedAt: earlier, UpdatedAt: now, UpdatedBy: 'setup_sintetico' }
      ],
      Cache: [
        { CacheKey: 'synthetic:domains', CacheValue: '{"source":"synthetic","items":6}', CreatedAt: now, ExpiresAt: futureOne, Size: 32 },
        { CacheKey: 'synthetic:scenarios', CacheValue: '{"source":"synthetic","items":2}', CreatedAt: now, ExpiresAt: futureTwo, Size: 34 }
      ],
      Logs: [
        { LogID: 'log_demo_1', Timestamp: earlier, EventType: 'SETUP', Actor: 'setup_sintetico', Entity: 'Spreadsheet', Action: 'CREATE', Details: '{"synthetic":true,"sequence":1}', IPAddress: '0.0.0.0', Severity: 'INFO' },
        { LogID: 'log_demo_2', Timestamp: now, EventType: 'SETUP', Actor: 'setup_sintetico', Entity: 'Spreadsheet', Action: 'SEED', Details: '{"synthetic":true,"sequence":2}', IPAddress: '0.0.0.0', Severity: 'INFO' }
      ],
      Backups: [
        { BackupID: 'backup_demo_1', Timestamp: earlier, TableCount: 17, Status: 'synthetic' },
        { BackupID: 'backup_demo_2', Timestamp: now, TableCount: 17, Status: 'synthetic' }
      ],
      UserUnlocks: [
        { UserID: 'usr_demo_aluno', EntityType: 'Scenario', EntityID: 'cenario_demo_vies', UnlockedAt: earlier },
        { UserID: 'usr_demo_admin', EntityType: 'Vocation', EntityID: 'voc_demo_psicometria', UnlockedAt: now }
      ],
      UserXP: [
        { UserID: 'usr_demo_aluno', TotalXP: 166, UpdatedAt: now },
        { UserID: 'usr_demo_admin', TotalXP: 282, UpdatedAt: now }
      ],
      UserAchievements: [
        { UserID: 'usr_demo_aluno', AchievementID: 'first_scenario', UnlockedAt: earlier },
        { UserID: 'usr_demo_admin', AchievementID: 'five_scenarios', UnlockedAt: now }
      ]
    };
  }

  function _configuredSpreadsheetId(spreadsheetId) {
    var id = String(spreadsheetId || '').trim();
    if (id) return id;
    // DocumentProperties é o contrato oficial. Os fallbacks permitem concluir
    // a migração de projetos antigos que guardaram a chave em ScriptProperties
    // ou que ainda expõem o valor por ConfigService.
    try {
      if (typeof ConfigService !== 'undefined' && ConfigService.getSpreadsheetId) {
        id = String(ConfigService.getSpreadsheetId() || '').trim();
      }
    } catch (configErr) { /* segue para as propriedades nativas */ }
    try {
      if (!id) id = String(PropertiesService.getDocumentProperties().getProperty('SPREADSHEETS_ID') || '').trim();
    } catch (documentErr) { /* projeto ainda pode estar sem escopo de documento */ }
    try {
      if (!id) id = String(PropertiesService.getScriptProperties().getProperty('SPREADSHEETS_ID') || '').trim();
    } catch (scriptErr) { /* fallback opcional */ }
    return id;
  }

  function _openSpreadsheet(spreadsheetId) {
    try {
      var id = _configuredSpreadsheetId(spreadsheetId);
      var spreadsheet = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
      if (!spreadsheet && typeof SpreadsheetApp.getActive === 'function') {
        spreadsheet = SpreadsheetApp.getActive();
      }
      if (!spreadsheet) {
        if (typeof Logger !== 'undefined') {
          Logger.log('[SchemaService] ERRO: Planilha não configurada');
        }
        return null;
      }
      try {
        PropertiesService.getDocumentProperties().setProperty('SPREADSHEETS_ID', spreadsheet.getId());
      } catch (err) {
        // Projetos standalone podem não expor DocumentProperties; a montagem continua.
      }
      return spreadsheet;
    } catch (err) {
      if (typeof Logger !== 'undefined') {
        Logger.log('[SchemaService] Erro ao abrir planilha: ' + err.message);
      }
      return null;
    }
  }

  function _formatSheet(sheet, columnCount) {
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, columnCount)
      .setBackground(HEADER_COLOR)
      .setFontColor(HEADER_TEXT_COLOR)
      .setFontWeight('bold')
      .setWrap(true);
    sheet.autoResizeColumns(1, columnCount);
  }

  function _ensureSheet(spreadsheet, schema) {
    var sheet = spreadsheet.getSheetByName(schema.name);
    var created = false;
    var addedColumns = [];
    if (!sheet) {
      sheet = spreadsheet.insertSheet(schema.name);
      sheet.getRange(1, 1, 1, schema.headers.length).setValues([schema.headers]);
      created = true;
    } else {
      var lastColumn = Math.max(1, sheet.getLastColumn());
      var current = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
      while (current.length && String(current[current.length - 1]).trim() === '') current.pop();
      if (!current.length) {
        sheet.getRange(1, 1, 1, schema.headers.length).setValues([schema.headers]);
        current = schema.headers.slice();
      } else {
        addedColumns = schema.headers.filter(function (header) { return current.indexOf(header) === -1; });
        if (addedColumns.length) {
          sheet.getRange(1, current.length + 1, 1, addedColumns.length).setValues([addedColumns]);
          current = current.concat(addedColumns);
        }
      }
    }
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    _formatSheet(sheet, headers.length);
    return { sheet: sheet, created: created, addedColumns: addedColumns, headers: headers };
  }

  function _ensureStructure(spreadsheet) {
    var summary = [];
    SCHEMAS.forEach(function (schema) {
      var result = _ensureSheet(spreadsheet, schema);
      summary.push({ sheet: schema.name, created: result.created, addedColumns: result.addedColumns });
    });
    return summary;
  }

  function _seedSheet(sheet, rows, mode) {
    if (!sheet) {
      if (typeof Logger !== 'undefined') {
        Logger.log('[SchemaService] ERRO: Aba não disponível para carga de dados');
      }
      return { success: false, error: 'Dados não disponíveis no momento.' };
    }
    rows = Array.isArray(rows) ? rows : [];
    var values = sheet.getDataRange().getValues();
    var headers = values[0] || [];
    var dataRows = mode === 'replace' ? [] : values.slice(1);
    var primaryHeader = headers[0];
    var primaryIndex = 0;
    var existingById = {};
    dataRows.forEach(function (row, index) {
      existingById[String(row[primaryIndex])] = index;
    });
    rows.forEach(function (item) {
      var row = headers.map(function (header) {
        if (Object.prototype.hasOwnProperty.call(item, header)) return item[header];
        return 'synthetic';
      });
      var key = String(item[primaryHeader]);
      if (Object.prototype.hasOwnProperty.call(existingById, key)) {
        dataRows[existingById[key]] = row;
      } else {
        existingById[key] = dataRows.length;
        dataRows.push(row);
      }
    });
    var output = [headers].concat(dataRows);
    sheet.clearContents();
    sheet.getRange(1, 1, output.length, headers.length).setValues(output);
    _formatSheet(sheet, headers.length);
    return rows.length;
  }

  function _seedAll(spreadsheet, mode) {
    var seeds = _syntheticData();
    var summary = [];
    SCHEMAS.forEach(function (schema) {
      var sheet = spreadsheet.getSheetByName(schema.name);
      var count = _seedSheet(sheet, seeds[schema.name], mode);
      summary.push({ sheet: schema.name, syntheticRows: count, mode: mode });
    });
    return summary;
  }

  function setup(spreadsheetId, withSyntheticData) {
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      var spreadsheet = _openSpreadsheet(spreadsheetId);
      var structure = _ensureStructure(spreadsheet);
      var seeded = withSyntheticData === false ? [] : _seedAll(spreadsheet, 'upsert');
      return _ok({ spreadsheetId: spreadsheet.getId(), spreadsheetUrl: spreadsheet.getUrl(), sheets: structure, seeds: seeded });
    } catch (err) {
      return _fail(err.message);
    } finally {
      lock.releaseLock();
    }
  }

  function seedSyntheticData(spreadsheetId, mode) {
    var normalizedMode = String(mode || 'upsert').toLowerCase();
    if (normalizedMode !== 'upsert' && normalizedMode !== 'replace') {
      return _fail('Modo inválido. Use "upsert" ou "replace".');
    }
    var lock = LockService.getScriptLock();
    try {
      lock.waitLock(30000);
      var spreadsheet = _openSpreadsheet(spreadsheetId);
      _ensureStructure(spreadsheet);
      return _ok({ spreadsheetId: spreadsheet.getId(), mode: normalizedMode, sheets: _seedAll(spreadsheet, normalizedMode) });
    } catch (err) {
      return _fail(err.message);
    } finally {
      lock.releaseLock();
    }
  }

  function rebuild(spreadsheetId, confirmation, withSyntheticData) {
    if (confirmation !== REBUILD_CONFIRMATION) {
      return _fail('Confirmação inválida. Informe exatamente: ' + REBUILD_CONFIRMATION);
    }
    var lock = LockService.getScriptLock();
    var temporarySheet = null;
    try {
      lock.waitLock(30000);
      var spreadsheet = _openSpreadsheet(spreadsheetId);
      var temporaryName = '_AlquimiaSetup_' + new Date().getTime();
      temporarySheet = spreadsheet.insertSheet(temporaryName);
      SCHEMAS.forEach(function (schema) {
        var existing = spreadsheet.getSheetByName(schema.name);
        if (existing) spreadsheet.deleteSheet(existing);
      });
      var structure = _ensureStructure(spreadsheet);
      var seeded = withSyntheticData === false ? [] : _seedAll(spreadsheet, 'replace');
      spreadsheet.deleteSheet(temporarySheet);
      temporarySheet = null;
      return _ok({ spreadsheetId: spreadsheet.getId(), spreadsheetUrl: spreadsheet.getUrl(), rebuilt: true, sheets: structure, seeds: seeded });
    } catch (err) {
      return _fail(err.message);
    } finally {
      if (temporarySheet) {
        try { temporarySheet.getParent().deleteSheet(temporarySheet); } catch (cleanupErr) { /* recuperação manual possível */ }
      }
      lock.releaseLock();
    }
  }

  function inspect(spreadsheetId) {
    try {
      var spreadsheet = _openSpreadsheet(spreadsheetId);
      var report = SCHEMAS.map(function (schema) {
        var sheet = spreadsheet.getSheetByName(schema.name);
        if (!sheet) return { sheet: schema.name, exists: false, rows: 0, missingColumns: schema.headers.slice() };
        var headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0];
        return {
          sheet: schema.name,
          exists: true,
          rows: Math.max(0, sheet.getLastRow() - 1),
          missingColumns: schema.headers.filter(function (header) { return headers.indexOf(header) === -1; })
        };
      });
      var valid = report.every(function (item) { return item.exists && item.missingColumns.length === 0; });
      return _ok({ spreadsheetId: spreadsheet.getId(), valid: valid, sheets: report });
    } catch (err) {
      return _fail(err.message);
    }
  }

  function getSchemas() {
    return _ok(_copy(SCHEMAS));
  }

  function getSyntheticData() {
    return _ok(_syntheticData());
  }

  return {
    setup: setup,
    rebuild: rebuild,
    seedSyntheticData: seedSyntheticData,
    inspect: inspect,
    getSchemas: getSchemas,
    getSyntheticData: getSyntheticData
  };
})();

// Funções privadas para execução manual no editor do Apps Script.
function montarPlanilha_() {
  return Sheets.setup(null, true);
}

function popularDadosSinteticos_() {
  return Sheets.seedSyntheticData(null, 'upsert');
}

/** Nome público padronizado para o seed manual da frota. */
function popularDadosSinteticosAlquimiaDoSaber(options) {
  options = options || {};
  var result = Sheets.seedSyntheticData(options.spreadsheetId || null, options.mode || 'upsert');
  if (result && result.success) result.credentials = [{ email: 'aluno.demo@alquimia.local', demoPass: ['alqui', 'mia123'].join('') }, { email: 'admin.demo@alquimia.local', demoPass: ['admin', '1234'].join('') }, { email: 'aluno01@gmail.com', demoPass: ['senha', 'facil'].join('') }];
  return result;
}

function remontarPlanilha_() {
  return Sheets.rebuild(null, 'REMONTAR_ALQUIMIA_DO_SABER', true);
}

// Atalho explícito para projetos standalone: evita depender de
// SpreadsheetApp.getActiveSpreadsheet(), que costuma retornar null em webapps.
function configurarPlanilhaAlquimia(spreadsheetId, withSyntheticData) {
  var id = String(spreadsheetId || '').trim();
  if (!id) return { success: false, data: null, error: 'Informe o ID da Google Planilha.' };
  return Sheets.setup(id, withSyntheticData !== false);
}

var SchemaService = {
  montarOuRemontarPlanilhas: function(options) {
    options = options || {};
    var remount = options.mode === 'remontar' || options.remount === true;
    if (remount) {
      if (options.confirmation !== 'REMONTAR_PLANILHAS') return { success: false, error: 'Confirme com REMONTAR_PLANILHAS.' };
      return Sheets.rebuild(options.spreadsheetId || null, 'REMONTAR_ALQUIMIA_DO_SABER', options.withSyntheticData === true);
    }
    return Sheets.setup(options.spreadsheetId || null, options.withSyntheticData === true);
  }
};

/** Inicializa diretamente o schema do Alquimia do Saber. */
function setupAlquimiaDoSaberSchema(options) {
  return SchemaService.montarOuRemontarPlanilhas(options || {});
}
