#!/usr/bin/env node
// Quick diagnostic: check if problems exist in the DB
// node --env-file=.env.local apps/web/src/scripts/diag-db.mjs

async function main() {
  // Check env
  var needed = ['DATABASE_URL','LAP_ALLOW_REAL_DB_INTEGRATION','LAP_IMPORT_DB_PERSIST_DEV_ENABLED','LAP_ALLOW_DEV_PROBLEM_IMPORT','LAP_ALLOW_EXTERNAL_PROBLEM_API'];
  for (var i = 0; i < needed.length; i++) {
    if (needed[i] === 'DATABASE_URL') {
      if (!process.env.DATABASE_URL) { console.log('MISSING: DATABASE_URL'); process.exit(1); }
    } else if (process.env[needed[i]] !== 'true') {
      console.log('MISSING:', needed[i], '(current:', process.env[needed[i]], ')');
    }
  }

  var db = await import('@learning-agent-platform/db');
  var prisma = db.getPrismaClient();

  var total = await prisma.problem.count();
  var cfCount = await prisma.problem.count({ where: { source: { contains: 'codeforces' } } });
  console.log('Total problems in DB:', total);
  console.log('Codeforces problems:', cfCount);

  if (cfCount > 0) {
    var samples = await prisma.problem.findMany({
      where: { source: { contains: 'codeforces' } },
      take: 3,
      select: { id: true, title: true, difficulty: true, tags: true, source: true }
    });
    console.log('Sample:');
    for (var s of samples) console.log('  ', s.id, '|', s.title, '|', s.difficulty, '|', s.tags.slice(0,3).join(','));
  } else {
    console.log('\nNO Codeforces problems in DB. Run:');
    console.log('  node --env-file=.env.local apps/web/src/scripts/cf-mass-import-v2.mjs --delete-first');
  }

  await prisma.$disconnect();
}
main().catch(function(e) { console.error(e.message); process.exit(1); });
