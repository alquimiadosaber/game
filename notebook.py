"""
================================================================================
  ALQUIMIA DO SABER — NOTEBOOK DE DOCUMENTAÇÃO TÉCNICA
  Sistema CRUD Google Apps Script + Google Sheets
  Versão: 1.0.0
================================================================================

  PROJETO: Alquimia do Saber
  SUBTÍTULO: Simulador Gamificado de Orientação Vocacional Computacional
  ARQUITETURA: Google Apps Script (GAS) como backend serverless
  PERSISTÊNCIA: Google Sheets como banco de dados NoSQL
  FRONTEND: HTML Service do Google Apps Script
  LINGUAGEM: JavaScript ES6+ (Google Apps Script runtime)

================================================================================
  RESUMO EXECUTIVO
================================================================================

  A "Alquimia do Saber" é um simulador gamificado de orientação vocacional
  computacional direcionado a adolescentes no limiar de decisões académicas
  críticas. A plataforma avalia as reações do utilizador a cenários de elevada
  complexidade, combinando três vetores epistémicos: Filosofia (1/4),
  Psicometria (1/4) e Inteligência Artificial/Computação (2/4).

  O resultado final é o direcionamento hiper-personalizado do jovem para uma
  ciência híbrida de vanguarda entre 60 carreiras catalogadas em 6 domínios.

================================================================================
  ESTADO ATUAL DO PROJETO (2026-07)
================================================================================

  Fase 1 (Fundação) implementada — 6 componentes .gs com lógica real:
    Utils.gs, ConfigService.gs, LoggerService.gs, CacheService.gs
    (exporta AppCacheService — ver nota de nomenclatura no próprio arquivo),
    Code.gs (doGet/doPost com whitelist de rotas PAGE_REGISTRY) e
    PasswordService.gs.

  Fase 2 (Autenticação) implementada — 4 componentes .gs com lógica real:
    SessionService.gs (sessões com token opaco na aba Sessions; GAS não tem
    cookie/sessão nativo entre chamadas de doGet — getActiveSession(token)
    exige o token explícito, ver nota de arquitetura no próprio arquivo),
    AuthService.gs (login/logout via PasswordService.verifyPassword()),
    RegisterService.gs (cria utilizador e reaproveita
    PasswordService.resetPassword() para gravar a senha inicial, evitando
    duplicar lógica de escrita; senha mínima alinhada em 8 caracteres) e
    PermissionService.gs (RBAC por prefixo de rota — matriz própria, mais
    simples que o PAGE_REGISTRY de Code.gs; os dois coexistem por design,
    ver nota de arquitetura no cabeçalho do arquivo).
    Code.gs ganhou as bridges top-level api_login/api_register/api_logout
    (google.script.run não invoca métodos de objetos IIFE) e passou a ler
    o token de sessão de e.parameter.token. login.html foi ajustado para
    guardar o token em localStorage e propagá-lo na URL ao redirecionar
    para welcome.html.

  SENHAS EM TEXTO PLANO (decisão revisada em 2026-07): PasswordService.gs
  chegou a ser reescrito com hash SHA-256 + salt por preocupação de
  segurança (dados de adolescentes numa planilha compartilhada). O
  responsável pelo projeto reafirmou explicitamente o requisito original de
  texto plano, mesmo após ser avisado do risco — PasswordService.gs,
  AuthService.gs e RegisterService.gs foram revertidos para gravar/comparar
  a senha literal na coluna Password da aba Users. A exceção está registrada
  por escrito no cabeçalho de PasswordService.gs e em SKILL.md. Mitigação
  residual, fora do código: restringir ao máximo o compartilhamento da
  planilha central.

  PENDÊNCIA CONHECIDA (não resolvida nesta fase): apenas o salto
  login → welcome propaga o token na URL. Os demais links internos
  (welcome.html → laboratory.html, vocation_list.html → vocation_detail.html
  etc.) ainda não reenviam ?token=... — ou seja, um doGet subsequente sem
  token voltará a tratar o utilizador como visitante. Resolver isso exige
  tocar os <a href="?page=..."> e location.href de várias páginas já
  construídas (ou migrar para um padrão de shell single-page) — tarefa
  separada, fora do escopo desta rodada de backend.

  Frontend — 9 componentes .html implementados com o design system "tubos
  de ensaio" (líquidos imiscíveis em camadas, uma cor por dimensão do saber:
  IA rosa, FIL azul, PSI laranja, NEU roxo, BIO verde, FIS amarelo, SOC
  ciano, ART coral). Conteúdo de mercado tratado sempre em termos de
  TENDÊNCIAS gerais, sem datas ou anos específicos (evergreen):
    index.html (landing), login.html e register.html (tubo que enche/muda
    de cor conforme o formulário), laboratory.html (sliders 0-4 quartos +
    tubo gigante; substitui a escala 0-100% do stub original), welcome.html
    (dashboard pós-login com tubo de progresso deitado), vocation_list.html
    (estante de mini-tubos com filtro por domínio + busca), vocation_detail.html
    (tubo grande + vocações relacionadas + blurb de tendência por domínio),
    result_dashboard.html (o "Ouro Alquímico": tubo dourado + radar SVG dos
    8 vectores, sem bibliotecas externas) e domain_map.html (6 frascos com
    gradiente de 2 cores, um por domínio A-F, linkando para vocation_list
    com ?domain= pré-selecionado).
    Todos degradam para modo demo quando google.script.run não está
    disponível, e esperam bridges globais api_* no backend (api_login,
    api_register, api_getWelcomeData, api_getNextScenario, api_submitPotion,
    api_getAllVocations, api_getVocationDetail, api_getResultDashboard,
    api_generateReport, api_getDomainMap) — google.script.run não invoca
    métodos de objetos IIFE, apenas funções top-level.

  Os demais 35 componentes .gs e 39 componentes .html continuam
  como STUBS documentados (cabeçalho de especificação + marcador TODO).
  A ordem de implementação recomendada (fases 3 a 6) e as regras
  obrigatórias de performance, quota e segurança estão em SKILL.md — leia
  antes de codificar a próxima fase (Núcleo do jogo: ScenarioController.gs →
  DimensionService.gs → InteractionService.gs → CauldronService.gs →
  ScoreService.gs), que é o que destrava as bridges api_getNextScenario e
  api_submitPotion já esperadas por laboratory.html.

================================================================================
  VARIÁVEIS DE AMBIENTE (PropertyService)
================================================================================

  SPREADSHEET_ID          → ID da planilha Google centralizada
  ADMIN_EMAIL             → E-mail do administrador do sistema
  LLM_API_KEY             → Chave de API para modelo de linguagem externo
  LLM_BASE_URL            → URL base do serviço LLM
  CACHE_TTL               → TTL em segundos para CacheService (padrão: 21600)
  BATCH_SIZE              → Tamanho máximo do lote para setValues (padrão: 1000)
  MAX_SESSION_DURATION    → Duração máxima da sessão em minutos (padrão: 60)
  TRIGGER_QUOTA_MINUTES   → Limite de minutos diários de gatilhos (padrão: 90)

================================================================================
  ARQUITETURA DE CAMADAS
================================================================================

  ┌─────────────────────────────────────────────────────────────────┐
  │  CAMADA 1 — FRONTEND (HTML Service)                             │
  │  34+ componentes .html — interfaces, formulários, dashboards    │
  │  JavaScript puro (vanilla) — sem dependências externas pesadas  │
  │  google.script.run — comunicação assíncrona cliente→servidor    │
  │  Scriptlets de impressão — injeção server-side no HTML          │
  │  Contextual escaping — proteção XSS nativa                      │
  └─────────────────────────────────────────────────────────────────┘
                           ↓ google.script.run
  ┌─────────────────────────────────────────────────────────────────┐
  │  CAMADA 2 — CONTROLADORES (40+ .gs)                            │
  │  doGet(e) → roteador principal → dispatch por rota              │
  │  13 controladores CRUD → mapeamento 1:1 com abas da planilha    │
  │  Autenticação → login/registro em Google Sheets                 │
  │  Senhas em texto plano por decisão da frota (risco aceito)      │
  └─────────────────────────────────────────────────────────────────┘
                           ↓ PropertiesService / CacheService
  ┌─────────────────────────────────────────────────────────────────┐
  │  CAMADA 3 — PERSISTÊNCIA (Google Sheets)                       │
  │  SPREADSHEET_ID → planilha centralizada                         │
  │  Abas = entidades (13 abas CRUD)                                │
  │  Operações em lote (batch) para performance                     │
  │  CacheService para mitigar quotas de UrlFetchApp                │
  └─────────────────────────────────────────────────────────────────┘

================================================================================
  MAPA DAS ABAS DA PLANILHA (SPREADSHEET_ID)
================================================================================

  Aba                         │ Entidade              │ Operações CRUD
  ────────────────────────────┼───────────────────────┼─────────────────────
  Users                       │ Utilizadores           │ Create / Read / Update
  Sessions                    │ Sessões ativas         │ Create / Read / Delete
  Users                       │ Autenticação           │ Read (login)
  Vocations                   │ 60 carreiras           │ Read (com filtro)
  Scenarios                   │ Cenários do jogo       │ Read / Create / Update
  User_Scenarios              │ Interações utilizador  │ Create / Read
  Dimensions                  │ Vectores psicométricos │ Read
  Scores                      │ Pontuações             │ Create / Read
  Results                     │ Resultados finais      │ Create / Read
  Cache                       │ Cache de dados         │ Create / Read / Delete
  Logs                        │ Registo de auditoria   │ Create / Read
  Settings                    │ Configurações          │ Read / Update
  Taxonomy                    │ 6 domínios vocacionais │ Read

================================================================================
  ÍNDICE DOS COMPONENTES .GS (40+ arquivos)
================================================================================

  ── Núcleo e Roteamento ──
  01. Code.gs                    → doGet(e), roteamento principal, configurações
  02. Utils.gs                   → Funções utilitárias, helpers, formatters
  03. LoggerService.gs           → Auditoria e logging para aba Logs
  04. CacheService.gs            → CacheService wrapper com TTL
  05. ConfigService.gs           → Leitura de PropertiesService e Settings

  ── Autenticação ──
  06. AuthService.gs             → Login, logout, validação de sessão
  07. RegisterService.gs         → Registro de novos utilizadores
  08. SessionService.gs          → Gestão de sessões (CRUD)
  09. PasswordService.gs         → Senha em texto plano (exceção documentada)
  10. PermissionService.gs       → Níveis de acesso (admin/user/guest)

  ── CRUD — Utilizadores ──
  11. UserController.gs          → CRUD completo de utilizadores
  12. UserProfileService.gs      → Perfis estendidos, avatares, preferências

  ── CRUD — Vocações ──
  13. VocationController.gs      → CRUD de 60 carreiras vocacionais
  14. DomainController.gs        → CRUD dos 6 domínios (A-F)
  15. TaxonomyService.gs         → Mapeamento fórmula epistémica ↔ carreira

  ── CRUD — Cenários ──
  16. ScenarioController.gs      → CRUD de cenários de jogo
  17. ScenarioCategoryService.gs → Categorias: bioética, quântica, semiótica...
  18. ScenarioDifficultyService.gs→ Níveis de dificuldade e progressão

  ── CRUD — Interações ──
  19. InteractionController.gs   → CRUD de interações utilizador-cenário
  20. InteractionService.gs      → Processamento de "poções" (misturas)

  ── CRUD — Dimensões ──
  21. DimensionController.gs     → CRUD de vectores psicométricos
  22. DimensionService.gs        → Cálculo de proporções 1/4 FIL, 1/4 PSI, 2/4 IA

  ── CRUD — Pontuações ──
  23. ScoreController.gs         → CRUD de pontuações
  24. ScoreService.gs            → Teoria de Resposta ao Item (TRI) aplicada
  25. ScoreRankingService.gs     → Rankings, leaderboards, percentis

  ── CRUD — Resultados ──
  26. ResultController.gs        → CRUD de resultados vocacionais
  27. ResultService.gs           → Algoritmo de matching vocacional
  28. ResultChartService.gs      → Geração de gráficos e Charts API

  ── CRUD — Configurações ──
  29. SettingsController.gs      → CRUD de configurações do sistema
  30. CacheController.gs         → CRUD da tabela de cache

  ── Integração LLM ──
  31. LLMService.gs              → Integração com modelo de linguagem externo
  32. PromptEngine.gs            → Geração de prompts para avaliação ética
  33. SemanticAnalyzer.gs        → Análise semântica de respostas livres

  ── Gamificação ──
  34. GamificationService.gs     → Níveis, XP, conquistas, badges
  35. CauldronService.gs         → Motor do "caldeirão computacional"
  36. NarrativeEngine.gs         → Narrativa adaptativa e avanço de enredo
  37. ProgressionService.gs      → Árvores de progressão e desbloqueios

  ── Relatório e Análise ──
  38. ReportService.gs           → Geração de relatórios individuais
  39. AnalyticsService.gs        → Análise agregada de turmas/escolas
  40. ExportService.gs           → Exportação CSV/PDF dos dados

  ── Gatilhos e Automação ──
  41. TriggerService.gs          → Instalação e gestão de triggers temporais
  42. MaintenanceService.gs      → Limpeza de sessões expiradas, cache
  43. NotificationService.gs     → Notificações por e-mail (MailApp)

  ── Validação e Segurança ──
  44. ValidationService.gs       → Validação de entrada (server-side)
  45. SanitizeService.gs         → Sanitização XSS e injection prevention

================================================================================
  ÍNDICE DOS COMPONENTES .HTML (48 arquivos)
================================================================================

  ── Estrutura Base ──
  01. index.html                 → Layout mestre, <div> containers, meta tags
  02. header.html                → Barra superior, logo, navegação primária
  03. footer.html                → Rodapé, créditos, links institucionais
  04. sidebar.html               → Navegação lateral com menu adaptativo

  ── Autenticação ──
  05. login.html                 → Formulário de login
  06. register.html              → Formulário de registro
  07. forgot_password.html       → Recuperação de senha (reset temporário)
  08. profile.html               → Perfil do utilizador
  09. settings.html              → Configurações pessoais
  09b. theme_settings.html       → Personalização de tema visual
  09c. welcome.html              → Boas-vindas pós-login
  09d. onboarding.html           → Tutorial para novos utilizadores

  ── Laboratório Principal ──
  10. laboratory.html            → Interface do caldeirão computacional
  11. cauldron.html              → Controles de mistura (3 barras deslizantes)
  12. potion_builder.html        → Construtor visual de poções epistémicas

  ── Cenários ──
  13. scenario_list.html         → Listagem de cenários disponíveis
  14. scenario_detail.html       → Detalhes de um cenário específico
  15. scenario_play.html         → Interface de jogo do cenário ativo
  16. scenario_history.html      → Histórico de cenários resolvidos
  16b. progression_tree.html     → Árvore visual de progressão

  ── Resultados e Vocação ──
  17. result_dashboard.html      → Painel de resultados individuais
  18. result_detail.html         → Detalhe da vocação identificada
  19. result_chart.html          → Gráfico de vectores psicométricos
  20. result_comparison.html     → Comparação entre resultados
  21. vocation_list.html         → Catálogo das 60 carreiras
  22. vocation_detail.html       → Detalhe de uma carreira específica
  23. domain_map.html            → Mapa dos 6 domínios (A-F)

  ── Gestão Administrativa ──
  24. admin_dashboard.html       → Painel do administrador
  25. admin_users.html           → Gestão de utilizadores (CRUD)
  26. admin_scenarios.html       → Gestão de cenários (CRUD)
  27. admin_vocations.html       → Gestão de vocações (CRUD)
  28. admin_settings.html        → Configurações do sistema
  29. admin_logs.html            → Visualização de logs de auditoria
  29b. maintenance_panel.html    → Manutenção do sistema (admin)
  29c. quota_dashboard.html      → Monitoramento de quota GAS

  ── Relatório e Análise ──
  30. report_individual.html     → Relatório individual do aluno
  31. report_classroom.html      → Relatório de turma
  32. report_school.html         → Relatório institucional
  33. analytics_dashboard.html   → Dashboard de analytics agregado

  ── Gamificação ──
  34. leaderboard.html           → Rankings e leaderboards
  35. achievement.html           → Conquistas e medalhas

  ── Dados e Suporte ──
  36. data_import.html           → Importação em lote (CSV/JSON)
  37. data_export.html           → Exportação de dados
  38. backup_restore.html        → Backup e restauração
  39. notification_panel.html    → Painel de notificações
  40. search_results.html        → Busca global
  41. help.html                  → Ajuda e FAQ
  42. error_page.html            → Página de erro genérica

  NOTA: componentes reutilizáveis (toast, modal, loading, breadcrumb,
  pagination) são implementados como parciais dentro de index.html via
  include() — não existem como arquivos separados.

================================================================================
  PADRÕES DE DESENVOLVIMENTO ADOTADOS
================================================================================

  1. BATCH OPERATIONS
     Todas as escritas são consolidadas em arrays bidimensionais e gravadas
     num único comando setValues(). Leituras usam getValues() em blocos.

  2. CACHE-FIRST
     Dados estáticos (vocações, domínios, cenários base) são armazenados no
     CacheService com TTL configurável para reduzir chamadas ao Sheets.

  3. CONTEXTUAL ESCAPING
     Scriptlets de impressão (<?= ?> e <?!= ?>) do HTML Service garantem
     escape automático contra XSS. Dados nunca são injetados diretamente.

  4. ASYNC CLIENT-SERVER
     Chamadas google.script.run são sempre assíncronas com handlers
     .withSuccessHandler() e .withFailureHandler() no cliente.

  5. SINGLETON SERVICES
     Cada serviço .gs exporta um objeto singleton via padrão de módulo
     para evitar instâncias múltiplas e conflito de estado.

  6. ERROR PROPAGATION
     Funções de serviço retornam { success: boolean, data: *, error: * }
     para padronização do tratamento de erros no cliente.

  7. SENHAS EM TEXTO PLANO (exceção de segurança documentada)
     Conforme requisito reafirmado pelo responsável do projeto (ver
     PasswordService.gs e SKILL.md para o registro completo da decisão),
     senhas são gravadas e comparadas em texto plano na coluna Password da
     aba Users. Mitigação residual, fora do código: restringir ao máximo o
     compartilhamento da planilha central.

  8. LOCKSERVICE EM ESCRITAS CONCORRENTES
     Registro, submissão de poções e pontuação usam
     LockService.getScriptLock() com timeout e liberação em finally,
     evitando corrupção quando uma turma inteira joga simultaneamente.

  9. FALLBACK DETERMINÍSTICO DE LLM
     Se o LLM externo falhar ou estourar quota, ScoreService pontua apenas
     pelas proporções da mistura (FIL/PSI/IA) — o jogo nunca bloqueia.

================================================================================
  DEPENDÊNCIAS EXTERNAS
================================================================================

  • Google Sheets API (nativa via SpreadsheetApp)
  • CacheService (nativa)
  • PropertiesService (nativa — DocumentProperties)
  • MailApp (notificações)
  • Charts API (geração de gráficos)
  • UrlFetchApp (integração LLM externo)

  NÃO UTILIZADO:
  • Bibliotecas externas no frontend (Bootstrap, jQuery, etc.)
  • Drive API (nenhum arquivo é armazenado no Drive)
  • Calendar / Gmail APIs (apenas MailApp para notificações)

================================================================================
  ESTRUTURA DE DIRETÓRIOS (todos na raiz)
================================================================================

  /alquimia-do-saber/
  ├── notebook.py                  ← Este arquivo
  ├── SKILL.md                     ← Skill de desenvolvimento (regras/padrões)
  ├── INDEX.md                     ← Índice detalhado de componentes
  ├── Relatorio.md                 ← Relatório estratégico do projeto
  ├── gen_remaining.py             ← Gerador de stubs .html
  │
  ├── Code.gs                      ← Ponto de entrada, doGet(e)
  ├── Utils.gs                     ← Utilitários globais
  ├── LoggerService.gs             ← Auditoria
  ├── CacheService.gs              ← Cache wrapper
  ├── ConfigService.gs             ← Configurações
  │
  ├── AuthService.gs               ← Login/Logout
  ├── RegisterService.gs           ← Registro
  ├── SessionService.gs            ← Sessões
  ├── PasswordService.gs           ← Senhas (texto plano)
  ├── PermissionService.gs         ← Permissões
  │
  ├── UserController.gs            ← CRUD Users
  ├── UserProfileService.gs        ← Perfis
  │
  ├── VocationController.gs        ← CRUD Vocações
  ├── DomainController.gs          ← CRUD Domínios
  ├── TaxonomyService.gs           ← Mapeamento epistémico
  │
  ├── ScenarioController.gs        ← CRUD Cenários
  ├── ScenarioCategoryService.gs   ← Categorias de cenários
  ├── ScenarioDifficultyService.gs ← Dificuldade
  │
  ├── InteractionController.gs     ← CRUD Interações
  ├── InteractionService.gs        ← Processamento de poções
  │
  ├── DimensionController.gs       ← CRUD Dimensões
  ├── DimensionService.gs          ← Cálculo psicométrico
  │
  ├── ScoreController.gs           ← CRUD Pontuações
  ├── ScoreService.gs              ← TRI aplicada
  ├── ScoreRankingService.gs       ← Rankings
  │
  ├── ResultController.gs          ← CRUD Resultados
  ├── ResultService.gs             ← Matching vocacional
  ├── ResultChartService.gs        ← Gráficos
  │
  ├── SettingsController.gs        ← CRUD Configurações
  ├── CacheController.gs           ← CRUD Cache
  │
  ├── LLMService.gs                ← Integração LLM
  ├── PromptEngine.gs              ← Prompts de avaliação
  ├── SemanticAnalyzer.gs          ← Análise semântica
  │
  ├── GamificationService.gs       ← Gamificação
  ├── CauldronService.gs           ← Motor do caldeirão
  ├── NarrativeEngine.gs           ← Narrativa adaptativa
  ├── ProgressionService.gs        ← Progressão
  │
  ├── ReportService.gs             ← Relatórios
  ├── AnalyticsService.gs          ← Análise agregada
  ├── ExportService.gs             ← Exportação
  │
  ├── TriggerService.gs            ← Gatilhos temporais
  ├── MaintenanceService.gs        ← Manutenção
  ├── NotificationService.gs       ← Notificações
  │
  ├── ValidationService.gs         ← Validação server-side
  ├── SanitizeService.gs           ← Sanitização
  │
  ├── index.html                   ← Template principal
  ├── header.html                  ← Cabeçalho
  ├── footer.html                  ← Rodapé
  ├── sidebar.html                 ← Menu lateral
  │
  ├── login.html                   ← Login
  ├── register.html                ← Registro
  ├── forgot_password.html         ← Recuperação
  ├── profile.html                 ← Perfil
  ├── settings.html                ← Configurações pessoais
  │
  ├── laboratory.html              ← Laboratório principal
  ├── cauldron.html                ← Caldeirão
  ├── potion_builder.html          ← Construtor de poções
  │
  ├── scenario_list.html           ← Lista de cenários
  ├── scenario_detail.html         ← Detalhe cenário
  ├── scenario_play.html           ← Jogo do cenário
  ├── scenario_history.html        ← Histórico
  │
  ├── result_dashboard.html        ← Dashboard resultados
  ├── result_detail.html           ← Detalhe resultado
  ├── result_chart.html            ← Gráfico vetorial
  ├── result_comparison.html       ← Comparação
  ├── vocation_list.html           ← Catálogo vocações
  ├── vocation_detail.html         ← Detalhe vocação
  ├── domain_map.html              ← Mapa domínios
  │
  ├── admin_dashboard.html         ← Admin painel
  ├── admin_users.html             ← Admin utilizadores
  ├── admin_scenarios.html         ← Admin cenários
  ├── admin_vocations.html         ← Admin vocações
  ├── admin_settings.html          ← Admin configurações
  ├── admin_logs.html              ← Admin logs
  │
  ├── report_individual.html       ← Relatório individual
  ├── report_classroom.html        ← Relatório turma
  ├── report_school.html           ← Relatório institucional
  ├── analytics_dashboard.html     ← Analytics
  │
  ├── leaderboard.html             ← Rankings
  ├── achievement.html             ← Conquistas
  ├── progression_tree.html        ← Progressão
  ├── onboarding.html              ← Onboarding
  ├── welcome.html                 ← Boas-vindas
  ├── theme_settings.html          ← Tema visual
  ├── maintenance_panel.html       ← Manutenção
  ├── quota_dashboard.html         ← Quota GAS
  ├── data_import.html             ← Importação
  ├── data_export.html             ← Exportação
  ├── backup_restore.html          ← Backup/restauração
  ├── notification_panel.html      ← Notificações
  ├── search_results.html          ← Busca global
  ├── help.html                    ← Ajuda/FAQ
  └── error_page.html              ← Página de erro

================================================================================
  CONTAGEM FINAL DE COMPONENTES
================================================================================

  Componentes .gs:     45 arquivos
  Componentes .html:   48 arquivos
  Documentação:        4 arquivos (notebook.py, SKILL.md, INDEX.md, Relatorio.md)
  Ferramentas:         1 arquivo (gen_remaining.py)
  ─────────────────────────────────
  TOTAL:               98 arquivos na raiz

================================================================================
  COMPATIBILIDADE E RESTRIÇÕES
================================================================================

  • Google Apps Script — runtime V8 (JavaScript ES2020)
  • Cota diária de UrlFetchApp: 20.000 chamadas (contas gratuitas)
  • Cota diária de triggers: 90 minutos de execução
  • Tempo máximo por execução: 6 minutos (runtime V8)
  • Limite de setValues(): 5.000.000 células por planilha
  • Limite de getValues(): 5.000.000 células por leitura
  • Limite de CacheService: 100 KB por chave

================================================================================
  FIM DO DOCUMENTO
================================================================================
"""
