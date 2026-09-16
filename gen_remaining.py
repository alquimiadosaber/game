#!/usr/bin/env python3
"""Gera stubs .html restantes do Alquimia do Saber.

Melhorias sobre a versão original:
- BASE relativo ao próprio script (funciona em Windows/Linux, não mais /home/ubuntu).
- Escrita em UTF-8 explícito (os stubs contêm acentos).
- Não sobrescreve arquivos já implementados: um arquivo é considerado
  implementado quando deixou de conter o marcador TODO do stub.
- --force para regenerar mesmo assim; --dry-run para apenas listar.
"""
import argparse
import os

BASE = os.path.dirname(os.path.abspath(__file__))
STUB_MARKER = "TODO: Implementar"


def html(name, header_desc, elements_str, integrations_str, features_str="",
         force=False, dry_run=False):
    content = f"""<!--
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — {name}
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   {header_desc}
 *
 * ELEMENTOS PRINCIPAIS:
 *   {elements_str}
 *
 * INTEGRAÇÕES (google.script.run):
 *   {integrations_str}
 *
 * {features_str}FUNCIONALIDADES ESPECÍFICAS:
 *   • Renderização server-side via scriptlets (<?= ?>).
 *   • Event listeners para interações do utilizador.
 *   • Feedback visual com toast notifications.
 *
 * PADRÕES:
 *   Vanilla JavaScript — sem dependências externas.
 *   Async handlers — .withSuccessHandler() e .withFailureHandler().
 *   Contextual escaping — injeção segura via scriptlets do HTML Service.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
-->

<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Alquimia do Saber — {name.replace('.html','')}</title>
  <style>
    /* Estilos específicos para {name} */
  </style>
</head>
<body>
  <!-- TODO: Implementar estrutura HTML conforme especificação acima -->
  <div id="{name.replace('.html','')}-container">
    <h1>{name.replace('.html','').replace('_',' ').title()}</h1>
    <p>Componente em desenvolvimento.</p>
  </div>
  <script>
    // TODO: Implementar lógica JavaScript vanilla
  </script>
</body>
</html>
"""
    path = os.path.join(BASE, name)
    if os.path.exists(path) and not force:
        with open(path, encoding="utf-8", errors="replace") as f:
            existing = f.read()
        if STUB_MARKER not in existing:
            print(f"SKIP (implementado): {name}")
            return
    if dry_run:
        print(f"DRY-RUN: geraria {name}")
        return
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    print(f"OK: {name}")


COMPONENTS = [
    ("analytics_dashboard.html",
     "Dashboard de analytics agregado. Visualizações de dados do sistema inteiro: utilização, vocações populares, distribuição de vectores e métricas de engajamento em tempo real.",
     "• Gráfico de utilização diária/semanal.\n   • Distribuição de vocações recomendadas.\n   • Mapa de calor de vectores psicométricos.\n   • Métricas de engajamento (cenários/dia).\n   • Top utilizadores por XP.\n   • Gráfico de domínios mais populares.\n   • Indicadores de sistema (quota, cache).",
     "• AnalyticsService.getSystemStatistics() — estatísticas.\n   • AnalyticsService.getVocationPopularity() — vocações populares.\n   • AnalyticsService.getDimensionDistribution() — distribuição.\n   • AnalyticsService.getEngagementMetrics() — engajamento.\n   • TriggerService.quotaCheck() — quota de triggers.",
     "Real-time data — dados atualizados em tempo real.\n   Chart visualizations — gráficos interativos.\n   System health — indicadores de saúde do sistema.\n"),
    ("leaderboard.html",
     "Painel de leaderboard (placar) do sistema. Exibe rankings globais, rankings por turma, posições individuais e comparação entre utilizadores. Gamificação visual com medalhas e posições.",
     "• Ranking global com top 20 utilizadores.\n   • Posição do utilizador corrente.\n   • Medalhas (ouro, prata, bronze).\n   • Filtro por turma.\n   • Comparação lado a lado.\n   • Histórico de posições.\n   • Botão de compartilhar posição.",
     "• ScoreRankingService.getGlobalRanking(limit) — ranking global.\n   • ScoreRankingService.getClassroomRanking(classId) — ranking turma.\n   • ScoreRankingService.getUserPercentile(userId) — percentil.\n   • UserController.getAllUsers() — dados dos utilizadores.",
     "Gamification — motivação por competição.\n   Real-time updates — posição atualizada após cada cenário.\n   Comparison view — comparação direta entre utilizadores.\n"),
    ("achievement.html",
     "Página de conquistas e medalhas. Exibe todas as conquistas disponíveis, as desbloqueadas pelo utilizador, progresso para próximas conquistas e critérios de desbloqueio.",
     "• Grid de conquistas (desbloqueadas e bloqueadas).\n   • Barra de progresso para próxima conquista.\n   • Critérios de cada conquista.\n   • Data de desbloqueio.\n   • Animação de desbloqueio (efeito confete).\n   • Filtro por tipo de conquista.\n   • Contagem total de conquistas.",
     "• GamificationService.getAchievements() — todas as conquistas.\n   • GamificationService.getBadges(userId) — medalhas do utilizador.\n   • GamificationService.checkAchievements(userId) — verificação.\n   • NotificationService.sendAchievementNotification() — notificação.",
     "Unlock animation — efeito visual ao desbloquear.\n   Progress tracking — barra de progresso para próximas.\n   Category filtering — filtro por tipo de conquista.\n"),
    ("progression_tree.html",
     "Árvore visual de progressão do simulador. Exibe o caminho completo do utilizador, cenários desbloqueados, lockados e os próximos marcos. Visualização em formato de árvore ou timeline.",
     "• Timeline de cenários concluídos.\n   • Cenários lockados com pré-requisitos visíveis.\n   • Próximos marcos (milestones).\n   • Percentagem de progresso geral.\n   • Indicador de vocação final desbloqueada.\n   • Botão de continuar progresso.\n   • Vista em árvore ou timeline.",
     "• ProgressionService.getProgressionTree(userId) — árvore de progressão.\n   • ProgressionService.getNextMilestone(userId) — próximo marco.\n   • ProgressionService.getProgressionPercent(userId) — percentagem.\n   • ScenarioController.getNextScenario(userId) — próximo cenário.",
     "Visual progression — árvore/timeline visual.\n   Milestone system — marcos intermediários motivacionais.\n   Lock/unlock indicators — indicadores claros de estado.\n"),
    ("onboarding.html",
     "Fluxo de onboarding para novos utilizadores. Apresenta o conceito do Alquimia do Saber, os 6 domínios vocacionais, a mecânica do caldeirão e guia o utilizador no primeiro cenário.",
     "• Introdução ao projeto Alquimia do Saber.\n   • Explicação dos 6 domínios vocacionais.\n   • Tutorial da mecânica do caldeirão.\n   • Demonstração das barras de controlo.\n   • Primeiro cenário guiado.\n   • Botão de pular tutorial.\n   • Progresso do onboarding (passo a passo).",
     "• DomainController.getAllDomains() — domínios para apresentar.\n   • ScenarioController.getRandomScenario() — primeiro cenário.\n   • UserProfileService.updateProfile() — marcar onboarding completo.\n   • CauldronService.initializeCauldron() — inicializar caldeirão.",
     "Step-by-step wizard — tutorial em etapas.\n   Skip option — possibilidade de pular tutorial.\n   Interactive demo — demonstração interativa da mecânica.\n   Progress tracking — progresso do onboarding salvo.\n"),
    ("help.html",
     "Página de ajuda e FAQ. Contém perguntas frequentes, instruções de uso do simulador, glossário de termos e links de suporte.",
     "• Lista de perguntas frequentes (accordion).\n   • Glossário de termos (FIL, PSI, IA, Ouro Alquímico).\n   • Instruções de uso do simulador.\n   • Links de suporte (e-mail, WhatsApp).\n   • Tutorial em vídeo (embed).\n   • Versão da aplicação.\n   • Contato da instituição.",
     "• ConfigService.getSetting('SUPPORT_EMAIL') — e-mail de suporte.\n   • ConfigService.getSetting('APP_VERSION') — versão.\n   • ConfigService.getSetting('INSTITUTIONAL_LINKS') — links.",
     "Accordion FAQ — perguntas expansíveis.\n   Glossary — definições de termos especializados.\n   Contact info — informações de contato da instituição.\n"),
    ("error_page.html",
     "Página de erro genérica. Exibe mensagem de erro amigável ao utilizador, botão de voltar e detalhes técnicos (em modo debug para admin).",
     "• Mensagem de erro amigável.\n   • Botão de voltar à página anterior.\n   • Botão de recarregar.\n   • Detalhes técnicos (apenas admin).\n   • Código de erro.\n   • Link para reportar problema.\n   • Sugestão de ação corretiva.",
     "• LoggerService.logError() — registro do erro.\n   • NotificationService.sendAdminAlert() — alerta para admin.\n   • PermissionService.isAdmin() — verificação de acesso a detalhes.",
     "User-friendly — mensagem compreensível pelo utilizador.\n   Debug mode — detalhes técnicos para admin.\n   Action-oriented — sugestões de ação corretiva.\n"),
    ("notification_panel.html",
     "Painel de notificações do sistema. Exibe notificações não lidas, histórico de notificações e permite marcar como lida. Tipos: conquistas, resultados, lembretes, alertas.",
     "• Lista de notificações não lidas.\n   • Indicador de contagem não lida.\n   • Marcar como lida (individual/lote).\n   • Histórico de notificações.\n   • Filtro por tipo.\n   • Limpar todas as notificações.\n   • Configurações de notificação.",
     "• NotificationService.sendAchievementNotification() — envio.\n   • LoggerService.getLogs() — histórico.\n   • UserProfileService.getProfile() — perfil do utilizador.",
     "Badge counter — indicador de não lidas.\n   Mark as read — marcação individual ou em lote.\n   Type filtering — filtro por tipo de notificação.\n"),
    ("welcome.html",
     "Página de boas-vindas para utilizadores logados. Apresenta resumo do dia, próximo cenário sugerido, progresso atual e acesso rápido às funcionalidades principais.",
     "• Saudação personalizada (Bom dia, Nome!).\n   • Próximo cenário sugerido.\n   • Resumo de progresso (% completado).\n   • Último resultado vocacional.\n   • Acesso rápido (botões).\n   • Mensagem motivacional.\n   • Estatísticas do dia.",
     "• UserProfileService.getProgress(userId) — progresso.\n   • ScenarioController.getNextScenario(userId) — próximo cenário.\n   • ResultController.getLatestResult(userId) — último resultado.\n   • DimensionService.getAggregateVector(userId) — vectores.\n   • GamificationService.getUserLevel(userId) — nível XP.",
     "Dashboard view — resumo consolidado na página inicial.\n   Personalized greeting — saudação com nome do utilizador.\n   Quick actions — botões de acesso rápido.\n   Motivational content — mensagens motivacionais.\n"),
    ("maintenance_panel.html",
     "Painel de manutenção do sistema (admin). Permite execução manual de tarefas de limpeza, visualização do último relatório de manutenção e configuração de retenção de dados.",
     "• Botão de executar manutenção completa.\n   • Relatório da última manutenção.\n   • Contagem de registros por aba.\n   • Configuração de retenção (dias).\n   • Botão de otimizar planilha.\n   • Histórico de manutenções.\n   • Indicador de tamanho da planilha.",
     "• MaintenanceService.runFullMaintenance() — manutenção completa.\n   • MaintenanceService.getMaintenanceReport() — relatório.\n   • MaintenanceService.optimizeSheet() — otimização.\n   • ConfigService.setSetting() — configuração de retenção.",
     "Admin-only — restrito a administradores.\n   One-click maintenance — execução com um clique.\n   Retention config — configuração de retenção ajustável.\n   Sheet optimization — otimização de tamanho.\n"),
    ("quota_dashboard.html",
     "Painel de quota do Google Apps Script. Exibe consumo de quota em tempo real: tempo de execução, triggers diários, chamadas de e-mail, tamanho de cache e limites do CacheService.",
     "• Barra de tempo de execução (90 min/dia).\n   • Barra de triggers diários.\n   • Barra de e-mails enviados.\n   • Barra de tamanho de cache (100KB/key).\n   • Alertas de quota próxima.\n   • Histórico de consumo.\n   • Botão de forçar cleanup.",
     "• TriggerService.quotaCheck() — verificação de quota.\n   • CacheService — consumo de cache.\n   • MailApp — e-mails enviados.\n   • PropertiesService — configurações de quota.",
     "Quota monitoring — monitoramento de limites.\n   Alert thresholds — alertas antes de atingir limite.\n   Force cleanup — limpeza forçada de dados.\n   Historical tracking — histórico de consumo.\n"),
    ("data_import.html",
     "Interface de importação de dados em lote. Permite importar utilizadores, cenários e vocações a partir de arquivos CSV ou JSON. Validação de schema antes da importação.",
     "• Upload de arquivo CSV/JSON.\n   • Preview dos dados antes de importar.\n   • Validação de schema (campos obrigatórios).\n   • Contagem de registros a importar.\n   • Botão de importar.\n   • Relatório de importação (sucesso/erros).\n   • Seletor de tipo de importação (users, scenarios, vocations).",
     "• UserController.createUser() — importação de utilizadores.\n   • ScenarioController.createScenario() — importação de cenários.\n   • VocationController.createVocation() — importação de vocações.\n   • ValidationService — validação de dados.\n   • LoggerService.log() — registro da importação.",
     "Batch import — importação em lote de dados.\n   Schema validation — validação de schema antes de importar.\n   Preview mode — pré-visualização antes de confirmar.\n   Error reporting — relatório de erros na importação.\n"),
    ("data_export.html",
     "Interface de exportação de dados do sistema. Permite exportar utilizadores, cenários, interações, pontuações e resultados em formatos CSV, JSON e PDF.",
     "• Seletor de tipo de dado (users, scenarios, scores, results).\n   • Seletor de formato (CSV, JSON, PDF).\n   • Filtro por período.\n   • Filtro por utilizador.\n   • Botão de exportar.\n   • Histórico de exportações.\n   • Botão de backup completo.",
     "• ExportService.exportUsersCSV() — exportação de utilizadores.\n   • ExportService.exportScoresCSV() — exportação de pontuações.\n   • ExportService.exportResultsCSV() — exportação de resultados.\n   • ExportService.exportAllDataJSON() — backup completo.\n   • ExportService.backupAllData() — backup total.",
     "Multi-format export — CSV, JSON, PDF.\n   Filtered export — exportação com filtros.\n   Full backup — backup completo do sistema.\n   Export history — histórico de exportações.\n"),
    ("theme_settings.html",
     "Configurações de tema visual do sistema. Permite ao utilizador personalizar cores, fontes, layout e preferências visuais. Inclui modo claro/escuro.",
     "• Seletor de tema (claro/escuro/auto).\n   • Personalização de cores primárias.\n   • Personalização de fontes.\n   • Densidade de interface (compacta/normal).\n   • Preview em tempo real.\n   • Botão de resetar para padrão.\n   • Salvar preferências.",
     "• UserProfileService.updateProfile() — salvar preferências.\n   • ConfigService.getSetting() — configurações de tema.\n   • ConfigService.setSetting() — salvar tema.",
     "Theme toggle — alternância claro/escuro.\n   Real-time preview — pré-visualização em tempo real.\n   Persistent preferences — preferências salvas na planilha.\n   CSS custom properties — cores via variáveis CSS.\n"),
    ("search_results.html",
     "Página de resultados de busca global. Permite buscar utilizadores, cenários, vocações e configurações com filtros combinados e resultados paginados.",
     "• Campo de busca global.\n   • Filtros por tipo (utilizador, cenário, vocação).\n   • Resultados agrupados por tipo.\n   • Paginação de resultados.\n   • Contagem total de resultados.\n   • Sugestões de busca.\n   • Busca recente.",
     "• UserController.searchUsers(query) — busca de utilizadores.\n   • ScenarioController.searchScenarios(query) — busca de cenários.\n   • VocationController.searchVocations(query) — busca de vocações.\n   • ConfigService.getAllSettings() — busca de configurações.",
     "Global search — busca em múltiplos tipos de dado.\n   Grouped results — resultados agrupados por tipo.\n   Recent searches — histórico de buscas recentes.\n   Auto-suggest — sugestões automáticas.\n"),
    ("backup_restore.html",
     "Interface de backup e restauração de dados. Permite criar backups manuais, listar backups existentes, restaurar de um backup e agendar backups automáticos.",
     "• Botão de criar backup manual.\n   • Lista de backups existentes.\n   • Botão de restaurar backup.\n   • Agendamento de backup automático.\n   • Tamanho do backup.\n   • Data de criação do backup.\n   • Verificação de integridade.",
     "• ExportService.backupAllData() — criação de backup.\n   • ImportService.importAllData() — restauração.\n   • TriggerService.installDailyTrigger() — agendamento.\n   • LoggerService.log() — registro do backup.\n   • ConfigService.getSetting() — configurações de backup.",
     "Manual + automatic — backups manuais e automáticos.\n   Integrity check — verificação de integridade do backup.\n   Point-in-time restore — restauração pontual.\n   Scheduled backups — agendamento via triggers.\n"),
]


def main():
    parser = argparse.ArgumentParser(description="Gera stubs .html restantes.")
    parser.add_argument("--force", action="store_true",
                        help="regenera mesmo arquivos já implementados")
    parser.add_argument("--dry-run", action="store_true",
                        help="apenas lista o que seria gerado")
    args = parser.parse_args()
    for comp in COMPONENTS:
        html(*comp, force=args.force, dry_run=args.dry_run)
    print("\n=== GERAÇÃO CONCLUÍDA ===")


if __name__ == "__main__":
    main()
