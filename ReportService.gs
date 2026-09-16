/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — ReportService.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Geração de relatórios individuais e institucionais. Produz documentos com perfil psicométrico, vocação recomendada e recomendações.
 *
 * FUNCIONALIDADES:
 *   • generateIndividualReport(userId) — Relatório individual.
   • generateClassroomReport(classId) — Relatório de turma.
   • generateSchoolReport(schoolId) — Relatório institucional.
   • generateVocationReport(vocationId) — Relatório de carreira.
   • exportReportAsPDF(reportId) — Exporta como PDF.
   • getReportTemplates() — Templates disponíveis.
   • generateExecutiveSummary(userId) — Resumo executivo.
 *
 * INTEGRAÇÕES:
 *   • ResultService — resultados vocacionais.
   • DimensionService — vectores psicométricos.
   • VocationController — dados da carreira.
   • AnalyticsService — dados agregados.
 * Template-based reports — modelos reutilizáveis.
   Multi-format export — PDF, CSV, HTML.
   Institutional aggregation — relatórios de turma e escola.
 *
 * PADRÕES:
 *   Batch read — getAllRows() para leituras otimizadas.
 *   Service result pattern — { success, data, error }.
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.1.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

const ReportService = (function () {

  function generateIndividualReport(userId) {
    try {
      var userResult = UserController.getUserById(userId);
      if (!userResult.success) return userResult;
      
      var user = userResult.data;
      var latestResult = ResultController.getLatestResult(userId);
      var dimensionsResult = DimensionService.getDimensionPercentages(userId);
      var progressResult = ProgressionService.getProgressionPercent(userId);
      var levelResult = GamificationService.getUserLevel(userId);
      
      var report = {
        reportId: Utils.generateId(),
        generatedAt: Utils.getTimestamp(),
        type: 'individual',
        user: {
          userId: user.UserID,
          fullName: user.FullName,
          email: user.Email,
          createdAt: user.CreatedAt
        },
        vocationalProfile: null,
        dimensions: dimensionsResult.success ? dimensionsResult.data : null,
        progression: {
          completionPercent: progressResult.success ? progressResult.data : 0,
          level: levelResult.success ? levelResult.data.level : 1,
          totalXP: levelResult.success ? levelResult.data.totalXP : 0
        },
        recommendations: []
      };
      
      if (latestResult.success && latestResult.data) {
        var vocationResult = VocationController.getVocationById(latestResult.data.VocationID);
        if (vocationResult.success) {
          report.vocationalProfile = {
            vocation: vocationResult.data,
            compatibility: latestResult.data.Score || 0,
            completedAt: latestResult.data.CompletedAt
          };
          
          // Gera recomendações
          report.recommendations.push('Continue explorando a área de ' + vocationResult.data.Title);
          report.recommendations.push('Desenvolva habilidades relacionadas ao domínio ' + vocationResult.data.Domain);
        }
      }
      
      return { success: true, data: report, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function generateExecutiveSummary(userId) {
    try {
      var reportResult = generateIndividualReport(userId);
      if (!reportResult.success) return reportResult;
      
      var report = reportResult.data;
      
      var summary = {
        userName: report.user.fullName,
        completionStatus: report.progression.completionPercent >= 100 ? 'Completo' : 'Em Progresso',
        topVocation: report.vocationalProfile ? report.vocationalProfile.vocation.Title : 'Não determinada',
        topDimension: null,
        level: report.progression.level,
        keyInsights: []
      };
      
      if (report.dimensions) {
        var topDim = null;
        var topVal = 0;
        Object.keys(report.dimensions).forEach(function(key) {
          if (report.dimensions[key] > topVal) {
            topVal = report.dimensions[key];
            topDim = key;
          }
        });
        summary.topDimension = topDim;
        
        if (topVal > 0.3) {
          summary.keyInsights.push('Forte afinidade com a dimensão ' + topDim);
        }
      }
      
      if (report.progression.completionPercent >= 75) {
        summary.keyInsights.push('Alto engajamento no processo de exploração vocacional');
      }
      
      return { success: true, data: summary, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function generateVocationReport(vocationId) {
    try {
      var vocationResult = VocationController.getVocationById(vocationId);
      if (!vocationResult.success) return vocationResult;
      
      var vocation = vocationResult.data;
      
      var resultsResult = Utils.getAllRows('Results');
      var matchCount = 0;
      
      if (resultsResult.success) {
        matchCount = resultsResult.data.filter(function(r) {
          return r.VocationID === vocationId;
        }).length;
      }
      
      var report = {
        reportId: Utils.generateId(),
        generatedAt: Utils.getTimestamp(),
        type: 'vocation',
        vocation: vocation,
        statistics: {
          totalMatches: matchCount,
          domain: vocation.Domain,
          formula: vocation.Formula
        },
        description: vocation.Description || 'Vocação no domínio ' + vocation.Domain,
        relatedVocations: []
      };
      
      // Busca vocações relacionadas no mesmo domínio
      var domainVocationsResult = VocationController.getVocationsByDomain(vocation.Domain);
      if (domainVocationsResult.success) {
        report.relatedVocations = domainVocationsResult.data
          .filter(function(v) { return v.VocationID !== vocationId; })
          .slice(0, 5)
          .map(function(v) { return v.Title; });
      }
      
      return { success: true, data: report, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function generateClassroomReport(classId) {
    try {
      var analytics = AnalyticsService.getClassroomAnalytics(classId);
      if (!analytics.success) return analytics;
      var data = analytics.data;
      return {
        success: true,
        data: {
          reportId: Utils.generateId(),
          generatedAt: Utils.getTimestamp(),
          type: 'classroom',
          classId: String(classId),
          analytics: data,
          recommendations: [
            data.participationRate < 70
              ? 'Planejar uma rodada mediada para ampliar a participação da turma.'
              : 'Manter a frequência de atividades e observar a diversidade de escolhas.',
            data.domainDistribution.length < 2
              ? 'Apresentar cenários de outros domínios para ampliar o repertório.'
              : 'Comparar os domínios mais frequentes sem transformar o resultado em rótulo.'
          ]
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function generateSchoolReport(schoolId) {
    try {
      var analytics = AnalyticsService.getSchoolAnalytics(schoolId);
      if (!analytics.success) return analytics;
      var data = analytics.data;
      return {
        success: true,
        data: {
          reportId: Utils.generateId(),
          generatedAt: Utils.getTimestamp(),
          type: 'school',
          schoolId: String(schoolId),
          analytics: data,
          recommendations: [
            data.participationRate < 70
              ? 'Priorizar apoio às turmas com menor participação antes de comparar resultados.'
              : 'A participação permite acompanhar tendências, preservando leitura formativa.',
            'Usar a distribuição por domínio para planejar experiências diversas, não para selecionar estudantes.'
          ]
        },
        error: null
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  function getReportTemplates() {
    try {
      var templates = [
        {
          id: 'individual_full',
          name: 'Relatório Individual Completo',
          description: 'Perfil psicométrico completo com vocação recomendada',
          sections: ['profile', 'dimensions', 'vocation', 'recommendations', 'progression']
        },
        {
          id: 'individual_summary',
          name: 'Resumo Executivo Individual',
          description: 'Visão geral condensada do perfil vocacional',
          sections: ['profile', 'vocation', 'key_insights']
        },
        {
          id: 'vocation_detail',
          name: 'Relatório de Vocação',
          description: 'Análise detalhada de uma vocação específica',
          sections: ['vocation_info', 'statistics', 'related_vocations']
        }
      ];
      
      return { success: true, data: templates, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  }

  function exportReportAsPDF(reportId) {
    try {
      var id = String(reportId || '').trim();
      if (!id) return { success: false, data: null, error: 'Identificador do relatório é obrigatório.' };
      return {
        success: false,
        data: { reportId: id, format: 'pdf', available: false },
        error: 'Exportação PDF indisponível nesta implantação. Use a impressão do navegador.'
      };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }

  return {
    generateIndividualReport: generateIndividualReport,
    generateClassroomReport: generateClassroomReport,
    generateSchoolReport: generateSchoolReport,
    generateVocationReport: generateVocationReport,
    exportReportAsPDF: exportReportAsPDF,
    getReportTemplates: getReportTemplates,
    generateExecutiveSummary: generateExecutiveSummary
  };
})();
