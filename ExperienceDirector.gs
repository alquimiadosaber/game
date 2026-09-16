/**
 * Diretor de experiência de Alquimia do Saber.
 * Inspirado em ZQuestClassic (capítulos/estado), Unciv (decisões por rodada)
 * e GCompris (andaimes e evidência formativa). Funções puras e determinísticas.
 *
 * Estrutura de fases:
 *   Fase 1 — Exploração (cap. 1–2): decisão binária clara, estado generoso.
 *   Fase 2 — Tensão     (cap. 3–4): 3 opções com trade-offs reais.
 *   Fase 3 — Crise      (cap. 5–6): decisões encadeadas, estado pressionado.
 */
var EXPERIENCE_GAME_ = {
  id: "alquimia-do-saber",
  title: "Alquimia do Saber",
  sharedResource: "diversidade de perspectivas",
  chapters: [
    // ── FASE 1 · Exploração ──────────────────────────────────────────────────
    { id: "escutar", order: 1, phase: 1, constraint: null,
      title: "O caldeirão das perguntas",
      situation: "A comunidade trouxe um dilema sem resposta única. Antes de misturar, é preciso ouvir o que cada perspectiva revela.",
      decisions: [
        { id: "contrastar", label: "Contrastar duas perspectivas e registrar tensões", delta: { knowledge: 2, cooperation: 1, pressure: -1 } },
        { id: "confirmar",  label: "Escolher apenas a perspectiva já preferida",      delta: { knowledge: -1, cooperation: -1, pressure: 1 } }
      ]
    },
    { id: "catalisar", order: 2, phase: 1, constraint: null,
      title: "A pesagem dos saberes",
      situation: "Diferentes fontes trazem dados empíricos e saberes ancestrais sobre a mesma erva medicinal.",
      decisions: [
        { id: "integrar-fontes", label: "Registrar a correlação entre conhecimento tradicional e evidência científica", delta: { knowledge: 2, cooperation: 1, pressure: -1 } },
        { id: "descartar-oral",  label: "Descartar o relato tradicional por não constar no manual rápido",             delta: { knowledge: -1, cooperation: -1, pressure: 2 } }
      ]
    },

    // ── FASE 2 · Tensão ──────────────────────────────────────────────────────
    { id: "compor", order: 3, phase: 2, constraint: "Tempo de fermentação: os reagentes são instáveis e a fórmula exige dosagem precisa.",
      title: "A mistura que não apaga diferenças",
      situation: "A solução deve combinar saberes sem fingir que todos dizem a mesma coisa, explicitando limites e hipóteses.",
      decisions: [
        { id: "equilibrar",  label: "Criar uma composição balanceada nomeando as contradições", delta: { knowledge: 2, cooperation: 2, pressure: -1 } },
        { id: "somar",       label: "Somar ingredientes sem justificar relações de causa",      delta: { knowledge: 0, cooperation: 0, pressure: 1 } },
        { id: "isolar-pura", label: "Isolar apenas uma substância pura ignorando o ecossistema", delta: { knowledge: 1, cooperation: -1, pressure: 1 } }
      ]
    },
    { id: "reagentes-raros", order: 4, phase: 2, constraint: "Recurso escasso: restam poucas amostras para os testes da turma.",
      title: "O dilema da destilação ética",
      situation: "Um reagente raro pode acelerar a poção, mas sua extração impacta a flora da reserva vizinha.",
      decisions: [
        { id: "substituto-sustentavel", label: "Pesquisar fitoterápico alternativo de menor impacto",     delta: { knowledge: 2, cooperation: 1, pressure: -1 } },
        { id: "fracionar-minimo",        label: "Usar microdoses coletivas e compartilhar com outros grupos", delta: { knowledge: 1, cooperation: 2, pressure: 0 } },
        { id: "esgotar-reserva",         label: "Utilizar todo o frasco para garantir resultado imediato",    delta: { knowledge: 0, cooperation: -2, pressure: 2 } }
      ]
    },

    // ── FASE 3 · Crise ───────────────────────────────────────────────────────
    { id: "devolver", order: 5, phase: 3, constraint: "Avaliação comunitária: os anciãos e os cientistas do vilarejo analisam o elixir.",
      title: "Conselho da comunidade alquímica",
      situation: "A proposta volta para quem vive o problema e precisa ser defendida com evidências, incertezas e respeito.",
      decisions: [
        { id: "consultar",   label: "Apresentar evidências e acolher contrapontos abertamente", delta: { knowledge: 1, cooperation: 2, pressure: -1 } },
        { id: "encerrar",    label: "Tratar a primeira versão como definitiva e inquestionável", delta: { knowledge: -1, cooperation: -2, pressure: 2 } },
        { id: "reformular",  label: "Propor uma co-criação da fórmula em rodada participativa", delta: { knowledge: 2, cooperation: 2, pressure: 0 } }
      ]
    },
    { id: "transmutacao-final", order: 6, phase: 3, constraint: "Grande Síntese: a poção final deve servir de guia para futuros aprendizes.",
      title: "A pedra filosofal do saber compartilhado",
      situation: "O grupo conclui a jornada e precisa registrar seu compêndio: como transformar conflitos de ideias em sabedoria comum.",
      decisions: [
        { id: "publicar-compendio", label: "Sistematizar o método de diálogo e registrar os erros como aprendizados", delta: { knowledge: 2, cooperation: 2, pressure: -1 } },
        { id: "guardar-segredo",    label: "Manter a receita em segredo para obter exclusividade de premiação",        delta: { knowledge: -1, cooperation: -3, pressure: 2 } },
        { id: "oficina-pratica",    label: "Realizar uma oficina para ensinar a destilação dialógica aos calouros",     delta: { knowledge: 2, cooperation: 3, pressure: -1 } }
      ]
    },

    // ── FASE 4 · Legado ──────────────────────────────────────────────────
    { id: "fundar-academia", order: 7, phase: 4, constraint: "Compromisso de longo prazo: as fórmulas devem ser legíveis para alunos de anos futuros.",
      title: "A fundação do compêndio aberto",
      situation: "O grupo decide registrar suas formulações para que futuros alquimistas não comecem do zero, sistematizando acertos e erros.",
      decisions: [
        { id: "compendio-aberto", label: "Publicar um compêndio detalhado com notas explicativas e margens de dúvida", delta: { knowledge: 2, cooperation: 2, pressure: -1 } },
        { id: "compendio-resumido", label: "Registrar apenas o resultado final sem explicar o processo de investigação", delta: { knowledge: 0, cooperation: -1, pressure: 1 } },
        { id: "tutoria-coletiva", label: "Instituir oficinas de mentoria onde os veteranos ensinam a destilação aos iniciantes", delta: { knowledge: 2, cooperation: 3, pressure: -1 } }
      ]
    },
    { id: "conselho-geracoes", order: 8, phase: 4, constraint: "Pacto Intergeracional: a sabedoria acumulada deve nortear as decisões éticas da escola.",
      title: "O pacto de sabedoria compartilhada",
      situation: "A comunidade escolar se reúne para consagrar o laboratório como patrimônio vivo de diálogo entre ciência e tradição.",
      decisions: [
        { id: "pacto-permanente", label: "Firmar o compromisso de manter o caldeirão aberto para acolher dilemas de toda a cidade", delta: { knowledge: 2, cooperation: 3, pressure: -1 } },
        { id: "monopolio-conhecimento", label: "Restringir o acesso ao laboratório apenas aos alunos com notas máximas", delta: { knowledge: -1, cooperation: -3, pressure: 2 } },
        { id: "conselho-aberto", label: "Criar um comitê rotativo de estudantes e mestres para gerir os recursos éticos", delta: { knowledge: 2, cooperation: 2, pressure: 0 } }
      ]
    }
  ]
};

function experienceClamp_(value) {
  return Math.max(0, Math.min(10, Number(value) || 0));
}

function getExperienceChapter(chapterId, year) {
  var chapter = EXPERIENCE_GAME_.chapters.filter(function (item) {
    return item.id === String(chapterId || '');
  })[0] || EXPERIENCE_GAME_.chapters[0];
  var schoolYear = Math.max(1, Math.min(5, Number(year) || 3));
  var phaseLabels = { 1: 'Exploração', 2: 'Tensão', 3: 'Crise', 4: 'Legado' };
  return {
    success: true,
    data: {
      gameId:         EXPERIENCE_GAME_.id,
      title:          chapter.title,
      situation:      chapter.situation,
      sharedResource: EXPERIENCE_GAME_.sharedResource,
      phase:          chapter.phase,
      phaseLabel:     phaseLabels[chapter.phase] || 'Exploração',
      constraint:     chapter.constraint || null,
      totalChapters:  EXPERIENCE_GAME_.chapters.length,
      decisions: chapter.decisions.map(function (item) { return { id: item.id, label: item.label }; }),
      cycle: {
        prediction:  schoolYear <= 2 ? 'Desenhe ou conte o que você acha que vai acontecer.' : 'Registre sua previsão e a evidência que pretende observar.',
        observation: 'O que mudou depois da escolha? Use um dado, sinal ou acontecimento do jogo.',
        explanation: 'Como a decisão contribuiu para esse resultado?',
        revision:    'O que o grupo manteria ou mudaria na próxima rodada?'
      },
      support: schoolYear <= 2 ? 'Leitura em voz alta, ícones e resposta oral.' : 'Tabela comparativa, pausa e papéis cooperativos.'
    }
  };
}

function resolveExperienceDecision(state, chapterId, decisionId, evidence) {
  var chapter = EXPERIENCE_GAME_.chapters.filter(function (item) {
    return item.id === String(chapterId || '');
  })[0] || EXPERIENCE_GAME_.chapters[0];
  var decision = chapter.decisions.filter(function (item) {
    return item.id === String(decisionId || '');
  })[0];
  if (!decision) return { success: false, error: 'Escolha não reconhecida para este capítulo.' };
  var current = state || {};
  var next = {
    chapter:     Math.min(EXPERIENCE_GAME_.chapters.length, (Number(current.chapter) || chapter.order) + 1),
    knowledge:   experienceClamp_((Number(current.knowledge)   || 5) + decision.delta.knowledge),
    cooperation: experienceClamp_((Number(current.cooperation) || 5) + decision.delta.cooperation),
    pressure:    experienceClamp_((Number(current.pressure)    || 2) + decision.delta.pressure)
  };
  var balance = next.knowledge + next.cooperation - next.pressure;
  return {
    success:   true,
    gameId:    EXPERIENCE_GAME_.id,
    choice:    { id: decision.id, label: decision.label },
    phase:     chapter.phase,
    previousState: {
      knowledge:   experienceClamp_(Number(current.knowledge)   || 5),
      cooperation: experienceClamp_(Number(current.cooperation) || 5),
      pressure:    experienceClamp_(Number(current.pressure)    || 2)
    },
    nextState:   next,
    consequence: balance >= 8
      ? 'A decisão ampliou a sabedoria coletiva e valorizou ' + EXPERIENCE_GAME_.sharedResource + '.'
      : balance >= 4
      ? 'A transmutação equilibrou saberes, embora ainda subsistam fricções que merecem diálogo.'
      : 'A decisão gerou rigidez no pensamento que requer humildade investigativa para transmutar.',
    evidence:    String(evidence || '').trim().substring(0, 420),
    reflection:  getExperienceChapter(chapterId, 3).data.cycle.revision,
    complete:    chapter.order >= EXPERIENCE_GAME_.chapters.length
  };
}

/**
 * Calcula o desfecho final com base no estado acumulado de Alquimia do Saber.
 */
function getExperienceEndgame(state) {
  var s = state || {};
  var k = experienceClamp_(Number(s.knowledge)   || 5);
  var c = experienceClamp_(Number(s.cooperation) || 5);
  var p = experienceClamp_(Number(s.pressure)    || 2);
  var balance = k + c - p;
  var route, title, summary, recommendation;
  if (balance >= 10) {
    route          = 'equilibrado';
    title          = 'Magnum Opus do Conhecimento';
    summary        = 'O grupo alcançou a transmutação perfeita: uniu saberes ancestrais e evidência rigorosa em harmonia cooperativa.';
    recommendation = 'Escrevam o tratado alquímico para a biblioteca da escola e organizem um simpósio.';
  } else if (p >= 7) {
    route          = 'sobrecarga';
    title          = 'Caldeirão em Ebulição';
    summary        = 'A busca por resultados imediatos aqueceu o ambiente, gerando fórmulas instáveis e desgaste entre os pares.';
    recommendation = 'Retomem os ensinamentos da fase 1 sobre escuta paciente e valorização do processo.';
  } else {
    route          = 'fragmentado';
    title          = 'Essências Desconectadas';
    summary        = 'O grupo produziu elixires técnicos competentes, mas falhou em integrá-los à vida comunitária.';
    recommendation = 'Debatam o capítulo 4 para rediscutir a partilha de recursos raros.';
  }
  return {
    success:        true,
    gameId:         EXPERIENCE_GAME_.id,
    route:          route,
    title:          title,
    summary:        summary,
    recommendation: recommendation,
    finalState:     { knowledge: k, cooperation: c, pressure: p, balance: balance }
  };
}

/**
 * Workflow mínimo compartilhado: orientar → prever → decidir → observar →
 * refletir. O estado retornado é serializável e pode ser salvo pelo cliente.
 */
function getExperienceBasicWorkflow(year) {
  var first = EXPERIENCE_GAME_.chapters[0];
  return {
    success: true,
    data: {
      gameId:    EXPERIENCE_GAME_.id,
      title:     EXPERIENCE_GAME_.title,
      chapterId: first.id,
      stage:     'briefing',
      stages:    ['briefing', 'prediction', 'decision', 'observation', 'reflection'],
      briefing:  getExperienceChapter(first.id, year).data,
      state:     { chapter: 1, knowledge: 5, cooperation: 5, pressure: 2 },
      complete:  false
    }
  };
}

function advanceExperienceBasicWorkflow(workflow, input, year) {
  var current = workflow && workflow.data ? workflow.data : workflow;
  if (!current || current.gameId !== EXPERIENCE_GAME_.id) {
    current = getExperienceBasicWorkflow(year).data;
  }
  var payload = input || {};
  var stages  = ['briefing', 'prediction', 'decision', 'observation', 'reflection'];
  var stage   = current.stage || 'briefing';
  var chapter = EXPERIENCE_GAME_.chapters.filter(function (item) {
    return item.id === String(current.chapterId || '');
  })[0] || EXPERIENCE_GAME_.chapters[0];

  // Verificação de pré-requisito na transição entre fases
  if (stage === 'briefing' && chapter.phase > 1) {
    var prevIdx     = chapter.order - 2;
    var prevChapter = prevIdx >= 0 ? EXPERIENCE_GAME_.chapters[prevIdx] : null;
    if (prevChapter && prevChapter.phase < chapter.phase &&
        (Number((current.state || {}).knowledge) || 5) < 3) {
      return {
        success:     true,
        needsReview: true,
        message:     'O grupo precisa dominar os fundamentos da fase anterior antes de avançar. Revisem suas hipóteses no laboratório.',
        data:        current
      };
    }
  }

  var next = {
    gameId:      EXPERIENCE_GAME_.id,
    title:       EXPERIENCE_GAME_.title,
    chapterId:   chapter.id,
    stage:       stage,
    stages:      stages.slice(),
    briefing:    getExperienceChapter(chapter.id, year).data,
    state:       current.state || { chapter: chapter.order, knowledge: 5, cooperation: 5, pressure: 2 },
    prediction:  String(current.prediction  || ''),
    observation: String(current.observation || ''),
    reflection:  String(current.reflection  || ''),
    lastResult:  current.lastResult || null,
    complete:    false
  };

  if (stage === 'briefing') {
    next.stage = 'prediction';
  } else if (stage === 'prediction') {
    next.prediction = String(payload.text || payload.prediction || '').trim().substring(0, 420);
    if (!next.prediction) return { success: false, error: 'Registre uma previsão antes de decidir.', data: next };
    next.stage = 'decision';
  } else if (stage === 'decision') {
    var result = resolveExperienceDecision(next.state, chapter.id, payload.decisionId, payload.evidence);
    if (!result.success) return { success: false, error: result.error, data: next };
    next.state      = result.nextState;
    next.lastResult = result;
    next.stage      = 'observation';
  } else if (stage === 'observation') {
    next.observation = String(payload.text || payload.observation || '').trim().substring(0, 420);
    if (!next.observation) return { success: false, error: 'Registre uma evidência observada.', data: next };
    next.stage = 'reflection';
  } else {
    next.reflection = String(payload.text || payload.reflection || '').trim().substring(0, 420);
    if (!next.reflection) return { success: false, error: 'Registre o que manter ou revisar.', data: next };
    var nextChapter = EXPERIENCE_GAME_.chapters[chapter.order];
    if (!nextChapter) {
      next.complete = true;
      next.stage    = 'complete';
      next.endgame  = getExperienceEndgame(next.state);
    } else {
      next.chapterId   = nextChapter.id;
      next.stage       = 'briefing';
      next.briefing    = getExperienceChapter(nextChapter.id, year).data;
      next.prediction  = '';
      next.observation = '';
      next.reflection  = '';
    }
  }
  return { success: true, data: next };
}

