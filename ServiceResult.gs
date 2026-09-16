/*
 * ALQUIMIA DO SABER — ServiceResult.gs
 * Contrato comum para fronteiras do backend.
 *
 * Toda API chamada por Controller ou google.script.run deve devolver sempre:
 * { success: boolean, data: qualquer, error: string|null }.
 * Este helper centraliza a forma do retorno e evita mensagens de excecao
 * inconsistentes entre servicos.
 */
const ServiceResult = (function () {
  function ok(data) {
    return { success: true, data: data === undefined ? null : data, error: null };
  }

  function fail(message, data) {
    var text = message instanceof Error ? message.message : String(message || 'Erro interno.');
    return { success: false, data: data === undefined ? null : data, error: text };
  }

  function from(result, fallback) {
    if (result && result.success === true) return ok(result.data);
    return fail(result && result.error ? result.error : 'Operação sem sucesso.',
      fallback === undefined ? null : fallback);
  }

  function guard(condition, message, data) {
    return condition ? null : fail(message, data);
  }

  function capture(operation, fallback) {
    try {
      var result = operation();
      return result && typeof result.success === 'boolean' ? result : ok(result);
    } catch (err) {
      return fail(err, fallback);
    }
  }

  function isSuccess(result) {
    return !!(result && result.success === true && result.error === null);
  }

  return {
    ok: ok,
    fail: fail,
    from: from,
    guard: guard,
    capture: capture,
    isSuccess: isSuccess
  };
})();
