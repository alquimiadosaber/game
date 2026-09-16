/**
 * codex-frontend-backend-healthcheck
 * Sonda de saude leve: confirma que o frontend alcanca o backend via
 * google.script.run e recebe o envelope padrao do projeto.
 *
 * - Sem efeitos colaterais, sem dependencia de sessao ou planilha.
 * - Arquivo isolado de proposito: nao altera nenhuma rota existente.
 * - Espelha o contrato do ServiceResult ({ success, data, error }), entao o
 *   frontend desempacota .data como em qualquer outra chamada.
 */
function ping() {
  try {
    return ServiceResult.ok({
      status: 'ok',
      service: 'backend',
      time: new Date().toISOString()
    });
  } catch (error) {
    Logger.log('Erro em ping: ' + error.message);
    throw error;
  }
}
