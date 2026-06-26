#!/usr/bin/env node
// Deep DB diagnostic
// node --env-file=.env.local apps/web/src/scripts/diag-db-deep.mjs

async function main() {
  console.log('1. Guard check...');
  var needed = ['DATABASE_URL','LAP_ALLOW_EXTERNAL_PROBLEM_API','LAP_ALLOW_DEV_PROBLEM_IMPORT','LAP_IMPORT_DB_PERSIST_DEV_ENABLED','LAP_ALLOW_REAL_DB_INTEGRATION'];
  for (var k of needed) console.log('  ', k, process.env[k] ? 'OK' : 'MISSING');

  console.log('2. Importing DB module...');
  var db = await import('@learning-agent-platform/db');
  console.log('  hasDatabaseUrl:', db.hasDatabaseUrl ? db.hasDatabaseUrl() : 'not exported');
  console.log('  hasDatabaseUrl (fn):', typeof db.hasDatabaseUrl);

  console.log('3. Getting Prisma client...');
  try {
    var prisma = db.getPrismaClient();
    console.log('  client:', typeof prisma, !!prisma);
    console.log('  problem model:', typeof prisma.problem);
    console.log('  problem.create:', typeof prisma.problem.create);
  } catch(e) {
    console.log('  ERROR:', e.message);
  }

  console.log('4. Trying raw query...');
  try {
    var prisma = db.getPrismaClient();
    var count = await prisma.problem.count();
    console.log('  problem count:', count);
  } catch(e) {
    console.log('  ERROR:', e.message);
  }

  console.log('5. Trying create via repository...');
  try {
    var prisma = db.getPrismaClient();
    var repo = new db.PrismaLearningRepository(prisma);
    console.log('  repo created');
    var result = await repo.createProblem({
      title: 'DIAG TEST ' + Date.now(),
      difficulty: 'easy',
      tags: ['test'],
      description: 'diagnostic test problem',
      source: 'diagnostic',
    });
    console.log('  created:', result.id, result.title);

    // Clean up
    await prisma.problem.delete({ where: { id: result.id } });
    console.log('  deleted test problem');
  } catch(e) {
    console.log('  ERROR:', e.message);
    console.log('  code:', e.code);
    console.log('  meta:', JSON.stringify(e.meta));
  }

  console.log('6. Trying list...');
  try {
    var prisma = db.getPrismaClient();
    var list = await prisma.problem.findMany({ take: 3, select: { id: true, title: true } });
    console.log('  listed', list.length, 'problems');
    for (var p of list) console.log('   ', p.id, p.title);
  } catch(e) {
    console.log('  ERROR:', e.message);
  }

  await prisma.$disconnect();
  console.log('\nDone.');
}
main().catch(function(e) { console.error('FATAL:', e.message); process.exit(1); });
