/**
 * Tests for text-import-db-persist-writer contract.
 * @previewOnly
 */

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) { passed++; }
  else { failed++; failures.push('FAIL: ' + label); }
}

async function runTests() {
  console.log('=== text-import-db-persist-writer.test.mjs ===');
  console.log('');

  const fs = await import('fs');
  const path = await import('path');
  const writerPath = path.join(process.cwd(), 'apps/web/src/app/import/text-import-db-persist-writer.ts');
  const source = fs.readFileSync(writerPath, 'utf-8');

  assert(source.includes('writeImportToDatabase'), '1.1: exports writeImportToDatabase');
  assert(source.includes('ImportDbPersistWriterResult'), '1.2: exports ImportDbPersistWriterResult type');
  assert(source.includes('PrismaBookRepository'), '1.3: uses PrismaBookRepository');
  assert(source.includes('createBookWithContent'), '1.4: calls createBookWithContent');
  assert(source.includes('evaluateImportDbPersistGuard'), '1.5: checks guard at write point');
  assert(source.includes('!guard.enabled'), '1.6: blocks when guard disabled');
  assert(source.includes('guard-blocked-at-write'), '1.7: reasonCode guard-blocked-at-write');
  assert(source.includes('saveRequest.saveReady'), '1.8: checks saveReady');
  assert(source.includes('saveRequest.blockedReasons'), '1.9: checks blockedReasons');
  assert(source.includes('saveRequest.safeChapters'), '1.10: checks safeChapters');
  assert(source.includes('save-not-ready'), '1.11: reasonCode save-not-ready');
  assert(source.includes('save-blocked'), '1.12: reasonCode save-blocked');
  assert(source.includes('no-chapters'), '1.13: reasonCode no-chapters');
  assert(source.includes('"dev-import / no real user"'), '1.14: author is hardcoded dev-import');
  assert(source.includes('"IMPORTED_TEXT"'), '1.15: sourceType is IMPORTED_TEXT');
  assert(source.includes('safeToExposeToClient'), '1.16: result includes safeToExposeToClient');
  assert(source.includes('writesDatabase'), '1.17: result includes writesDatabase');
  assert(source.includes('callsRepository'), '1.18: result includes callsRepository');
  assert(source.includes('devOnly'), '1.19: result includes devOnly');
  assert(source.includes('productionReady'), '1.20: result includes productionReady');
  assert(source.includes('SENSITIVE_ERROR_PATTERNS'), '1.21: defines error redaction patterns');
  assert(source.includes('redactSensitiveErrorMessage'), '1.22: has error redaction function');
  assert(source.includes('[已隐藏]'), '1.23: uses [已隐藏] for redaction');
  assert(source.includes('TextImportSaveRequestPreview'), '1.24: accepts TextImportSaveRequestPreview');
  assert(source.includes('CreateBookWithContentInput'), '1.25: builds CreateBookWithContentInput');

  const forbiddenPatterns = [/postgresql?:\/\/[^\s"']+/, /DATABASE_URL\s*=\s*["'][^"']+["']/, /password\s*=\s*["'][^"']+["']/, /api[_-]?key\s*=\s*["'][^"']+["']/];
  for (const pattern of forbiddenPatterns) {
    assert(!pattern.test(source), '2.x: no hardcoded secrets in writer source');
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
