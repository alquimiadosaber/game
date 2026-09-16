/*
 * ══════════════════════════════════════════════════════════════════════════════
 * ALQUIMIA DO SABER — TestSuite.example.gs
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * DESCRIÇÃO:
 *   Suite de testes de exemplo para validação de componentes críticos.
 *   Demonstra padrão AAA (Arrange, Act, Assert) e integração com Logger.
 *
 * COMO USAR:
 *   1. Copie este arquivo para seu projeto GAS
 *   2. Execute função individual: runTest_ValidationService_validateEmail()
 *   3. Ou execute suite completa: runAllExampleTests()
 *   4. Veja resultados em: View > Logs (Ctrl+Enter)
 *
 * NOTA:
 *   Estes são testes de EXEMPLO. Para produção, você precisará:
 *   - Dados de teste reais na planilha
 *   - Mocks para dependências externas
 *   - Assertions mais robustas
 *
 * AUTOR: Alquimia do Saber
 * VERSÃO: 1.0.0
 * ══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function assert(condition, message) {
  if (!condition) {
    Logger.log('❌ ASSERTION FAILED: ' + message);
    return false;
  }
  return true;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    Logger.log('❌ ASSERTION FAILED (' + label + '): Expected "' + expected + '", got "' + actual + '"');
    return false;
  }
  return true;
}

function logTestHeader(testName) {
  Logger.log('\n' + '='.repeat(70));
  Logger.log('TEST: ' + testName);
  Logger.log('='.repeat(70));
}

function logTestResult(testName, passed) {
  if (passed) {
    Logger.log('✅ PASS: ' + testName);
  } else {
    Logger.log('❌ FAIL: ' + testName);
  }
  Logger.log('='.repeat(70) + '\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION SERVICE TESTS
// ═══════════════════════════════════════════════════════════════════════════

function runTest_ValidationService_validateEmail_valid() {
  logTestHeader('ValidationService.validateEmail() - Email válido');
  
  var passed = true;
  
  try {
    // ─── ARRANGE ────────────────────────────────────────
    var email = 'teste@exemplo.com';
    
    // ─── ACT ────────────────────────────────────────────
    var result = ValidationService.validateEmail(email);
    
    // ─── ASSERT ─────────────────────────────────────────
    Logger.log('[LGPD] Evento registrado; detalhes sensíveis omitidos.');
    Logger.log('Result: ' + JSON.stringify(result, null, 2));
    
    passed = passed && assert(result.success === true, 'Deve retornar success=true');
    passed = passed && assert(result.data !== null, 'Deve retornar data não nulo');
    passed = passed && assert(typeof result.data.available === 'boolean', 'Deve retornar available como boolean');
    
  } catch (err) {
    Logger.log('❌ EXCEPTION: ' + err.message);
    passed = false;
  }
  
  logTestResult('ValidationService.validateEmail() - Email válido', passed);
  return passed;
}

function runTest_ValidationService_validateEmail_invalid() {
  logTestHeader('ValidationService.validateEmail() - Email inválido');
  
  var passed = true;
  
  try {
    // ─── ARRANGE ────────────────────────────────────────
    var invalidEmails = ['teste@', '@exemplo.com', 'teste', 'teste@exemplo', ''];
    
    // ─── ACT & ASSERT ───────────────────────────────────
    invalidEmails.forEach(function(email) {
      var result = ValidationService.validateEmail(email);
      
      Logger.log('[LGPD] Evento registrado; detalhes sensíveis omitidos.');
      Logger.log('Result: ' + JSON.stringify(result, null, 2));
      
      passed = passed && assert(result.success === true, 'Deve retornar success=true (validação executada)');
      passed = passed && assert(result.data.available === false, 'Email inválido deve retornar available=false');
      passed = passed && assert(result.data.reason !== null, 'Deve fornecer razão da rejeição');
    });
    
  } catch (err) {
    Logger.log('❌ EXCEPTION: ' + err.message);
    passed = false;
  }
  
  logTestResult('ValidationService.validateEmail() - Email inválido', passed);
  return passed;
}

function runTest_ValidationService_validatePassword_strong() {
  logTestHeader('ValidationService.validatePassword() - Senha forte');
  
  var passed = true;
  
  try {
    // ─── ARRANGE ────────────────────────────────────────
    var strongPassword = 'Senha123!@#';
    
    // ─── ACT ────────────────────────────────────────────
    var result = ValidationService.validatePassword(strongPassword);
    
    // ─── ASSERT ─────────────────────────────────────────
    Logger.log('Input: ' + strongPassword);
    Logger.log('Result: ' + JSON.stringify(result, null, 2));
    
    passed = passed && assert(result.success === true, 'Deve retornar success=true');
    passed = passed && assert(result.data.valid === true, 'Senha forte deve ser válida');
    
  } catch (err) {
    Logger.log('❌ EXCEPTION: ' + err.message);
    passed = false;
  }
  
  logTestResult('ValidationService.validatePassword() - Senha forte', passed);
  return passed;
}

function runTest_ValidationService_validatePassword_weak() {
  logTestHeader('ValidationService.validatePassword() - Senha fraca');
  
  var passed = true;
  
  try {
    // ─── ARRANGE ────────────────────────────────────────
    var weakPasswords = ['123', '1234567', '', 'abc'];
    
    // ─── ACT & ASSERT ───────────────────────────────────
    weakPasswords.forEach(function(password) {
      var result = ValidationService.validatePassword(password);
      
      Logger.log('[LGPD] Evento registrado; detalhes sensíveis omitidos.');
      Logger.log('Result: ' + JSON.stringify(result, null, 2));
      
      passed = passed && assert(result.success === true, 'Deve retornar success=true (validação executada)');
      passed = passed && assert(result.data.valid === false, 'Senha fraca deve ser inválida');
      passed = passed && assert(result.data.reason !== null, 'Deve fornecer razão da rejeição');
    });
    
  } catch (err) {
    Logger.log('❌ EXCEPTION: ' + err.message);
    passed = false;
  }
  
  logTestResult('ValidationService.validatePassword() - Senha fraca', passed);
  return passed;
}

// ═══════════════════════════════════════════════════════════════════════════
// CAULDRON SERVICE TESTS
// ═══════════════════════════════════════════════════════════════════════════

function runTest_CauldronService_validateMixture_valid() {
  logTestHeader('CauldronService.validateMixture() - Mistura válida');
  
  var passed = true;
  
  try {
    // ─── ARRANGE ────────────────────────────────────────
    var validMixtures = [
      { fil: 25, psi: 25, ia: 50 },
      { fil: 33, psi: 33, ia: 34 },
      { fil: 0, psi: 0, ia: 100 },
      { fil: 100, psi: 0, ia: 0 }
    ];
    
    // ─── ACT & ASSERT ───────────────────────────────────
    validMixtures.forEach(function(mixture) {
      var result = CauldronService.validateMixture(mixture.fil, mixture.psi, mixture.ia);
      
      Logger.log('Testing mixture: FIL=' + mixture.fil + ', PSI=' + mixture.psi + ', IA=' + mixture.ia);
      Logger.log('Result: ' + JSON.stringify(result, null, 2));
      
      passed = passed && assert(result.success === true, 'Deve retornar success=true');
      passed = passed && assert(result.data.valid === true, 'Mistura válida deve passar');
    });
    
  } catch (err) {
    Logger.log('❌ EXCEPTION: ' + err.message);
    passed = false;
  }
  
  logTestResult('CauldronService.validateMixture() - Mistura válida', passed);
  return passed;
}

function runTest_CauldronService_validateMixture_invalid() {
  logTestHeader('CauldronService.validateMixture() - Mistura inválida');
  
  var passed = true;
  
  try {
    // ─── ARRANGE ────────────────────────────────────────
    var invalidMixtures = [
      { fil: 30, psi: 30, ia: 30, reason: 'soma != 100' },
      { fil: -10, psi: 60, ia: 50, reason: 'valores negativos' },
      { fil: 150, psi: 0, ia: 0, reason: 'valores > 100' },
      { fil: 50, psi: 50, ia: 50, reason: 'soma > 100' }
    ];
    
    // ─── ACT & ASSERT ───────────────────────────────────
    invalidMixtures.forEach(function(mixture) {
      var result = CauldronService.validateMixture(mixture.fil, mixture.psi, mixture.ia);
      
      Logger.log('Testing invalid mixture (' + mixture.reason + '): FIL=' + mixture.fil + ', PSI=' + mixture.psi + ', IA=' + mixture.ia);
      Logger.log('Result: ' + JSON.stringify(result, null, 2));
      
      passed = passed && assert(result.success === false, 'Deve retornar success=false para mistura inválida');
      passed = passed && assert(result.error !== null, 'Deve fornecer mensagem de erro');
    });
    
  } catch (err) {
    Logger.log('❌ EXCEPTION: ' + err.message);
    passed = false;
  }
  
  logTestResult('CauldronService.validateMixture() - Mistura inválida', passed);
  return passed;
}

function runTest_CauldronService_calculateReaction_balanced() {
  logTestHeader('CauldronService.calculateReaction() - Reação balanceada');
  
  var passed = true;
  
  try {
    // ─── ARRANGE ────────────────────────────────────────
    var fil = 33;
    var psi = 33;
    var ia = 34;
    
    // ─── ACT ────────────────────────────────────────────
    var result = CauldronService.calculateReaction(fil, psi, ia);
    
    // ─── ASSERT ─────────────────────────────────────────
    Logger.log('Input: FIL=' + fil + ', PSI=' + psi + ', IA=' + ia);
    Logger.log('Result: ' + JSON.stringify(result, null, 2));
    
    passed = passed && assert(result.success === true, 'Deve retornar success=true');
    passed = passed && assert(result.data.reactionType === 'balanced', 'Deve detectar reação balanceada');
    passed = passed && assert(result.data.description !== null, 'Deve fornecer descrição');
    
  } catch (err) {
    Logger.log('❌ EXCEPTION: ' + err.message);
    passed = false;
  }
  
  logTestResult('CauldronService.calculateReaction() - Reação balanceada', passed);
  return passed;
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR MESSAGES TESTS
// ═══════════════════════════════════════════════════════════════════════════

function runTest_ErrorMessages_get_validCode() {
  logTestHeader('ErrorMessages.get() - Código válido');
  
  var passed = true;
  
  try {
    // ─── ARRANGE ────────────────────────────────────────
    var code = 'AUTH_001';
    
    // ─── ACT ────────────────────────────────────────────
    var result = ErrorMessages.get(code);
    
    // ─── ASSERT ─────────────────────────────────────────
    Logger.log('Input: ' + code);
    Logger.log('Result: ' + JSON.stringify(result, null, 2));
    
    passed = passed && assert(result.success === true, 'Deve retornar success=true');
    passed = passed && assert(result.data.code === code, 'Deve retornar código correto');
    passed = passed && assert(result.data.message !== null, 'Deve retornar mensagem');
    
  } catch (err) {
    Logger.log('❌ EXCEPTION: ' + err.message);
    passed = false;
  }
  
  logTestResult('ErrorMessages.get() - Código válido', passed);
  return passed;
}

function runTest_ErrorMessages_format_withParams() {
  logTestHeader('ErrorMessages.format() - Com parâmetros');
  
  var passed = true;
  
  try {
    // ─── ARRANGE ────────────────────────────────────────
    var code = 'VALID_100';
    var params = { field: 'Email' };
    
    // ─── ACT ────────────────────────────────────────────
    var result = ErrorMessages.format(code, params);
    
    // ─── ASSERT ─────────────────────────────────────────
    Logger.log('Input: code=' + code + ', params=' + JSON.stringify(params));
    Logger.log('Result: ' + JSON.stringify(result, null, 2));
    
    passed = passed && assert(result.success === true, 'Deve retornar success=true');
    passed = passed && assert(result.data.message.indexOf('Email') !== -1, 'Mensagem deve conter parâmetro interpolado');
    
  } catch (err) {
    Logger.log('❌ EXCEPTION: ' + err.message);
    passed = false;
  }
  
  logTestResult('ErrorMessages.format() - Com parâmetros', passed);
  return passed;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ═══════════════════════════════════════════════════════════════════════════

function runAllExampleTests() {
  Logger.clear();
  
  Logger.log('\n' + '█'.repeat(70));
  Logger.log('█' + ' '.repeat(15) + 'ALQUIMIA DO SABER - TEST SUITE' + ' '.repeat(15) + '█');
  Logger.log('█'.repeat(70) + '\n');
  
  var results = [];
  
  // ValidationService Tests
  Logger.log('▶ Running ValidationService Tests...\n');
  results.push({ name: 'ValidationService.validateEmail - valid', passed: runTest_ValidationService_validateEmail_valid() });
  results.push({ name: 'ValidationService.validateEmail - invalid', passed: runTest_ValidationService_validateEmail_invalid() });
  results.push({ name: 'ValidationService.validatePassword - strong', passed: runTest_ValidationService_validatePassword_strong() });
  results.push({ name: 'ValidationService.validatePassword - weak', passed: runTest_ValidationService_validatePassword_weak() });
  
  // CauldronService Tests
  Logger.log('▶ Running CauldronService Tests...\n');
  results.push({ name: 'CauldronService.validateMixture - valid', passed: runTest_CauldronService_validateMixture_valid() });
  results.push({ name: 'CauldronService.validateMixture - invalid', passed: runTest_CauldronService_validateMixture_invalid() });
  results.push({ name: 'CauldronService.calculateReaction - balanced', passed: runTest_CauldronService_calculateReaction_balanced() });
  
  // ErrorMessages Tests
  Logger.log('▶ Running ErrorMessages Tests...\n');
  results.push({ name: 'ErrorMessages.get - valid code', passed: runTest_ErrorMessages_get_validCode() });
  results.push({ name: 'ErrorMessages.format - with params', passed: runTest_ErrorMessages_format_withParams() });
  
  // Summary
  var passed = results.filter(function(r) { return r.passed; }).length;
  var failed = results.filter(function(r) { return !r.passed; }).length;
  var total = results.length;
  
  Logger.log('\n' + '█'.repeat(70));
  Logger.log('█' + ' '.repeat(25) + 'TEST SUMMARY' + ' '.repeat(25) + '█');
  Logger.log('█'.repeat(70));
  Logger.log('Total:  ' + total + ' tests');
  Logger.log('Passed: ' + passed + ' ✅');
  Logger.log('Failed: ' + failed + ' ❌');
  Logger.log('Coverage: ' + Math.round((passed / total) * 100) + '%');
  Logger.log('█'.repeat(70) + '\n');
  
  // Detailed failures
  if (failed > 0) {
    Logger.log('Failed Tests:');
    results.filter(function(r) { return !r.passed; }).forEach(function(r) {
      Logger.log('  ❌ ' + r.name);
    });
    Logger.log('');
  }
}
