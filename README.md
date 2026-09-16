# Alquimia do Saber

## Essência

Simulador de exploração vocacional e interdisciplinar em que o estudante responde a cenários sociotécnicos, combina diferentes modos de investigar um problema e justifica suas escolhas. A metáfora do “caldeirão” transforma Filosofia, Psicometria, Inteligência Artificial e outros campos em ingredientes para pensar, argumentar e revisar soluções.

O valor pedagógico não está em prever uma profissão. Está em tornar visíveis os interesses, as estratégias de raciocínio e as perguntas que a criança deseja aprofundar.

## Comece aqui

Execute `npm run verify` antes de sincronizar mudanças. O ciclo oficial de
configuração, validação, Apps Script, publicação, smoke test e evidências está em
[WORKFLOW_BASICO.md](WORKFLOW_BASICO.md).

## Descrição

O fluxo implementado reúne cenários, respostas abertas, misturas epistêmicas, progressão, catálogo de vocações e relatórios. Serviços como `ScenarioController.gs`, `InteractionService.gs`, `TaxonomyService.gs`, `PromptEngine.gs` e `ReportService.gs` sustentam a jornada cenário → decisão → justificativa → devolutiva.

Para a Escola Classe 115 Norte, a proposta deve ser usada preferencialmente com 4º e 5º anos, com linguagem adaptada, mediação docente e situações próximas da vida escolar. Os resultados são pistas para conversa e planejamento de experiências, nunca diagnóstico psicométrico, teste de aptidão ou prescrição de carreira.

## Objetivo pedagógico

Ampliar o repertório de áreas do conhecimento e desenvolver pensamento crítico, argumentação, autoconhecimento e flexibilidade cognitiva por meio de problemas abertos que admitem mais de uma solução defensável.

### Resultados de aprendizagem esperados

- reconhecer que problemas complexos podem exigir conhecimentos de áreas diferentes;
- formular uma escolha e justificá-la com evidências do cenário;
- comparar estratégias, identificar limites e revisar a própria resposta;
- relacionar interesses atuais a experiências de aprendizagem, sem cristalizar identidades;
- distinguir recomendação algorítmica de decisão humana;
- produzir perguntas de investigação para um próximo ciclo.

## Ciclo didático recomendado

1. **Provocar:** o professor apresenta um cenário curto e verifica conhecimentos prévios.
2. **Investigar:** a turma identifica fatos, dúvidas, pessoas afetadas e informações ausentes.
3. **Compor:** cada estudante ou grupo monta sua “poção epistêmica”, distribuindo ênfases entre modos de pensar.
4. **Justificar:** a escolha precisa ser explicada oralmente, por desenho, texto ou áudio.
5. **Comparar:** soluções distintas são confrontadas sem ranking de pessoas.
6. **Revisar:** o estudante registra o que manteria e o que mudaria após ouvir os colegas.
7. **Transferir:** a turma aplica a estratégia a um problema real da escola.

## Integração curricular

| Área | Foco de aprendizagem | Evidência observável |
|---|---|---|
| Língua Portuguesa | compreensão do cenário, argumentação e revisão | justificativa com posição, razão e exemplo |
| Matemática | proporções, comparação de pesos e leitura de gráficos | explicação de como a distribuição altera o resultado |
| Ciências | investigação, hipótese, evidência e impacto de tecnologias | pergunta testável e identificação de limites |
| História e Geografia | contexto social, trabalho, tecnologia e território | análise de quem é afetado e em qual contexto |
| Cultura Digital | funcionamento e limites de recomendações algorítmicas | distinção entre dado, cálculo, interpretação e decisão |
| Projeto de vida nos anos iniciais | interesses, curiosidades e repertório de possibilidades | plano de uma experiência a explorar, sem rótulo vocacional |

O alinhamento prioriza as Competências Gerais da BNCC 1, 2, 5, 6, 7, 9 e 10. O código de habilidade específico deve ser escolhido pelo professor conforme o ano, o cenário e o planejamento da turma.

## Avaliação formativa

A pontuação do jogo não equivale à avaliação pedagógica. A observação docente considera quatro dimensões:

| Dimensão | Em aproximação | Em desenvolvimento | Consolidando |
|---|---|---|---|
| Compreensão do problema | repete elementos isolados | identifica problema e envolvidos | relaciona causas, consequências e lacunas |
| Uso de evidências | opina sem apoio | cita um dado do cenário | compara evidências e reconhece incerteza |
| Argumentação | declara a escolha | apresenta uma razão | articula escolha, razão, exemplo e contraponto |
| Metacognição | mantém a resposta sem reflexão | identifica algo aprendido | revisa a estratégia e explica por quê |

Evidências úteis: primeira resposta, justificativa, revisão pós-debate, pergunta gerada pelo estudante e autoavaliação. Ranking, tempo de tela e proximidade com uma “vocação” não devem compor nota.

## Reversão pedagógica

Os relatórios de turma devem mostrar padrões agregados de perguntas, áreas mais exploradas e estratégias recorrentes. O professor pode usar esses dados para:

- planejar oficinas e visitas que ampliem campos pouco conhecidos;
- formar grupos com perguntas complementares;
- retomar dificuldades de argumentação ou leitura de dados;
- comparar a primeira e a segunda versão de uma solução;
- convidar profissionais e familiares sem sugerir destinos obrigatórios.

## Inclusão e acessibilidade

- oferecer cenário em texto, leitura em voz alta, ícones e versão resumida;
- permitir resposta oral, visual, dramatizada ou escrita;
- retirar pressão de tempo e competição;
- explicar termos técnicos antes da decisão;
- não associar preferência, deficiência, gênero ou desempenho escolar a carreira;
- garantir alternativa integral sem IA quando o serviço externo estiver indisponível.

## Governança de IA e salvaguardas

- O matching de `TaxonomyService.gs` é heurístico e depende do catálogo; não mede potencial humano.
- A IA pode sugerir perguntas e feedback, mas não atribui diagnóstico, nota, perfil psicológico ou carreira.
- Toda devolutiva destinada ao estudante passa por revisão docente.
- Textos livres devem ser minimizados, protegidos e excluídos de prompts quando contiverem dados pessoais.
- Relatórios coletivos usam agregação e evitam exposição individual.
- O estudante pode contestar, refazer ou ignorar uma recomendação.

## Sequência piloto

| Encontro | Ação | Produto |
|---|---|---|
| 1 | cenário coletivo e modelagem de uma justificativa | mapa de fatos, dúvidas e envolvidos |
| 2 | resolução em pequenos grupos | poção epistêmica e justificativa multimodal |
| 3 | comparação e revisão | segunda versão comentada |
| 4 | transferência para um problema da escola | proposta de investigação ou intervenção |

## Status de implementação

O projeto possui fluxo funcional, catálogo, serviços de cenário, matching, relatórios, gamificação e integração opcional com LLM. As telas de perfil, progressão, dimensões e detalhe do resultado usam bridges autenticadas e derivam o aluno da sessão; a administração de cenários e configurações possui persistência real. O gate local atual registra **93,0/100**, com 47 testes automatizados aprovados. Antes de uso pedagógico real, requer curadoria dos cenários para os anos iniciais, validação docente das devolutivas e piloto que trate os resultados como exploração, não como mensuração psicométrica validada.

## Tecnologias e documentação

- Google Apps Script e HTML Service;
- Google Sheets como persistência;
- integração opcional com modelo de linguagem;
- [índice técnico](INDEX.md);
- [relatório estratégico](Relatorio.md).

## Suporte pedagógico

O planejamento deve registrar ano/turma, objetivo da aula, cenário escolhido, formas de resposta, critérios de observação e intervenção posterior. Qualquer uso orientador formal exige instrumento validado e profissional habilitado fora do escopo deste webapp.

## Navegação da Frota

- [Voltar ao README principal](../README.md)
- [Relatório Geral da Frota](../Relatorio.md)
- [Auditoria da Frota](../AUDITORIA_FROTA_COMPLETA.md)

---

Parte da Frota Educacional da Escola Classe 115 Norte — **31 projetos**.
