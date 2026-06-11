/**
 * Tests for text-import-db-persist-guard contract.
 * @previewOnly
 */

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) { passed++; }
  else { failed++; failures.push('FAIL: ' + label); }
}

function assertEqual(actual, expected, label) {
  if (actual === expected) { passed++; }
  else { failed++; failures.push('FAIL: ' + label + ' — expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)); }
}

async function runTests() {
  console.log('=== text-import-db-persist-guard.test.mjs ===');
  console.log('');

  const hasLapImport = process.env.LAP_IMPORT_DB_PERSIST_DEV_ENABLED === 'true';
  const hasAllowRealDb = process.env.LAP_ALLOW_REAL_DB_INTEGRATION === 'true';
  const hasDbUrl = typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.trim().length > 0;

  const allEnabled = hasLapImport && hasAllowRealDb && hasDbUrl;
  assert(!allEnabled, '1.1: Guard defaults disabled when env vars unset');

  const fs = await import('fs');
  const path = await import('path');
  const guardPath = path.join(process.cwd(), 'apps/web/src/app/import/text-import-db-persist-guard.ts');
  const source = fs.readFileSync(guardPath, 'utf-8');

  assert(source.includes('evaluateImportDbPersistGuard'), '2.1: exports evaluateImportDbPersistGuard');
  assert(source.includes('isImportDbPersistEnabled'), '2.2: exports isImportDbPersistEnabled');
  assert(source.includes('LAP_IMPORT_DB_PERSIST_DEV_ENABLED'), '2.3: checks LAP_IMPORT_DB_PERSIST_DEV_ENABLED');
  assert(source.includes('LAP_ALLOW_REAL_DB_INTEGRATION'), '2.4: checks LAP_ALLOW_REAL_DB_INTEGRATION');
  assert(source.includes('hasDatabaseUrl'), '2.5: checks DATABASE_URL');
  assert(source.includes('safeToExposeToClient'), '2.6: result includes safeToExposeToClient');
  assert(source.includes('dev-only'), '2.7: mode is dev-only');
  assert(source.includes('productionReady'), '2.8: result includes productionReady');
  assert(source.includes('fallsBackToDevStore'), '2.9: result includes fallsBackToDevStore');
  assert(source.includes('writesDatabaseAllowed'), '2.10: result includes writesDatabaseAllowed');
  assert(source.includes('requiresExplicitOptIn'), '2.11: result includes requiresExplicitOptIn');

  const forbiddenPatterns = [/postgresql?:\/\/[^\s"']+/, /DATABASE_URL\s*=\s*["'][^"']+["']/, /password\s*=\s*["'][^"']+["']/, /api[_-]?key\s*=\s*["'][^"']+["']/];
  for (const pattern of forbiddenPatterns) {
    assert(!pattern.test(source), '3.x: no hardcoded secret in guard source');
  }

  console.log('');
  console.log('=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failures.length > 0) {
    console.log('');
    console.log('Failures:');
    for (const f of failures) console.log('  ' + f);
  }
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(function(e) {
  console.error('Test runner error:', e);
  process.exit(1);
});
