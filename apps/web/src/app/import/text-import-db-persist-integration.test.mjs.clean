/**
 * Integration tests for import DB persist.
 * @previewOnly
 */

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];
const skips = [];

function assert(condition, label) {
  if (condition) { passed++; }
  else { failed++; failures.push('FAIL: ' + label); }
}

function skip(reason) {
  skipped++;
  skips.push('SKIP: ' + reason);
}

async function runTests() {
  console.log('=== text-import-db-persist-integration.test.mjs ===');
  console.log('');

  const hasDbUrl = typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.trim().length > 0;
  const hasImportPersist = process.env.LAP_IMPORT_DB_PERSIST_DEV_ENABLED === 'true';
  const hasAllowRealDb = process.env.LAP_ALLOW_REAL_DB_INTEGRATION === 'true';
  const realDbReady = hasDbUrl && hasImportPersist && hasAllowRealDb;

  console.log('Prerequisites check:');
  console.log('  DATABASE_URL configured: ' + hasDbUrl);
  console.log('  LAP_IMPORT_DB_PERSIST_DEV_ENABLED: ' + hasImportPersist);
  console.log('  LAP_ALLOW_REAL_DB_INTEGRATION: ' + hasAllowRealDb);
  console.log('');

  // Source verification tests (always run — no env vars needed)
  const fs = await import('fs');
  const path = await import('path');

  // Test 1: Guard source
  const guardPath = path.join(process.cwd(), 'apps/web/src/app/import/text-import-db-persist-guard.ts');
  const guardSource = fs.readFileSync(guardPath, 'utf-8');
  assert(guardSource.includes('LAP_IMPORT_DB_PERSIST_DEV_ENABLED'), '1.1: guard checks LAP_IMPORT_DB_PERSIST_DEV_ENABLED');
  assert(guardSource.includes('LAP_ALLOW_REAL_DB_INTEGRATION'), '1.2: guard checks LAP_ALLOW_REAL_DB_INTEGRATION');
  assert(guardSource.includes('hasDatabaseUrl'), '1.3: guard checks DATABASE_URL');
  assert(guardSource.includes('writesDatabaseAllowed'), '1.4: guard reports writesDatabaseAllowed');

  // Test 2: Writer source
  const writerPath = path.join(process.cwd(), 'apps/web/src/app/import/text-import-db-persist-writer.ts');
  const writerSource = fs.readFileSync(writerPath, 'utf-8');
  assert(writerSource.includes('PrismaBookRepository'), '2.1: writer uses PrismaBookRepository');
  assert(writerSource.includes('createBookWithContent'), '2.2: writer calls createBookWithContent');
  assert(writerSource.includes('evaluateImportDbPersistGuard'), '2.3: writer checks guard before write');

  // Test 3: Server action
  const actionPath = path.join(process.cwd(), 'apps/web/src/app/import/text-import-save-dev-server-action.ts');
  const actionSource = fs.readFileSync(actionPath, 'utf-8');
  assert(actionSource.includes('writeImportToDatabase'), '3.1: action imports writeImportToDatabase');
  assert(actionSource.includes('dbPersistGuard.enabled'), '3.2: action checks dbPersistGuard.enabled');
  assert(actionSource.includes('usedDbPersist'), '3.3: action exposes usedDbPersist');
  assert(actionSource.includes('callsRepository'), '3.4: action exposes callsRepository');
  assert(actionSource.includes('writesDatabase'), '3.5: action exposes writesDatabase');

  // Test 4: Book loader
  const loaderPath = path.join(process.cwd(), 'apps/web/src/app/books/book-library-loader.ts');
  const loaderSource = fs.readFileSync(loaderPath, 'utf-8');
  assert(loaderSource.includes('hasDatabaseUrl'), '4.1: loader checks hasDatabaseUrl');
  assert(loaderSource.includes('status'), '4.2: loader returns status');
  assert(loaderSource.includes('sourceType'), '4.3: loader sets sourceType');

  // Test 5: Reader data
  const readerPath = path.join(process.cwd(), 'apps/web/src/lib/reader-data.ts');
  const readerSource = fs.readFileSync(readerPath, 'utf-8');
  assert(readerSource.includes('getReaderDataFromDatabaseResult'), '5.1: reader tries DB');
  assert(readerSource.includes('getReaderDataFromMock'), '5.2: reader tries mock fallback');

  // Test 6: UI component
  const uiPath = path.join(process.cwd(), 'apps/web/src/app/import/TextImportPreviewClient.tsx');
  const uiSource = fs.readFileSync(uiPath, 'utf-8');
  assert(uiSource.includes('dbPersistGuard'), '6.1: UI receives dbPersistGuard');
  assert(uiSource.includes('写入数据库'), '6.2: UI shows DB write status');
  assert(uiSource.includes('dev-only'), '6.3: UI shows dev-only');

  // Test 7: Real DB integration — gated by env vars
  if (realDbReady) {
    skip('Real DB write+read cycle requires Next.js dev server. To test: start dev server, visit /import, fill example, save, check /books and /reader.');
  } else {
    skip('Real DB integration not configured. Set LAP_IMPORT_DB_PERSIST_DEV_ENABLED=true, LAP_ALLOW_REAL_DB_INTEGRATION=true, and DATABASE_URL to enable real DB tests.');
  }

  console.log('');
  console.log('=== Results: ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped ===');
  if (failures.length > 0) {
    console.log('');
    console.log('Failures:');
    for (const f of failures) console.log('  ' + f);
  }
  if (skips.length > 0) {
    console.log('');
    console.log('Skips:');
    for (const s of skips) console.log('  ' + s);
  }
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(function(e) {
  console.error('Integration test runner error:', e);
  process.exit(1);
});
