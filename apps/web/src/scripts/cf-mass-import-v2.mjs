#!/usr/bin/env node
// cf-mass-import — imports ~8500 Codeforces problems minus interactive ones

async function main() {
  var args = process.argv.slice(2);
  var DRY_RUN = args.includes('--dry-run');
  var DELETE_FIRST = args.includes('--delete-first');
  console.log('CF Mass Import:', DRY_RUN ? 'DRY' : DELETE_FIRST ? 'DEL+IMP' : 'LIVE');

  var needed = ['LAP_ALLOW_EXTERNAL_PROBLEM_API','LAP_ALLOW_DEV_PROBLEM_IMPORT','LAP_IMPORT_DB_PERSIST_DEV_ENABLED','LAP_ALLOW_REAL_DB_INTEGRATION'];
  var missing = [];
  for (var i = 0; i < needed.length; i++) { if (process.env[needed[i]] !== 'true') missing.push(needed[i]); }
  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (process.env.NODE_ENV === 'production') missing.push('NODE_ENV=production');

  if (missing.length > 0) {
    console.error('Missing env:', missing.join(', '));
    console.error('Run: node --env-file=.env.local apps/web/src/scripts/cf-mass-import-v2.mjs');
    process.exit(1);
  }
  console.log('Guards OK');

  var db = await import('@learning-agent-platform/db');
  var prisma = db.getPrismaClient();
  console.log('DB connected');

  if (DELETE_FIRST) {
    console.log('Finding old problems...');
    var old = await prisma.problem.findMany({ where: { source: { contains: 'codeforces' } }, select: { id: true } });
    console.log('Found', old.length, 'old CF problems');
    if (old.length > 0) {
      var ids = old.map(function(p) { return p.id; });
      await prisma.$transaction(async function(tx) {
        await tx.problemAttempt.deleteMany({ where: { problemId: { in: ids } } });
        await tx.problemWrongBook.deleteMany({ where: { problemId: { in: ids } } });
        await tx.dailyRecommendation.deleteMany({ where: { problemId: { in: ids } } });
        await tx.problem.deleteMany({ where: { id: { in: ids } } });
      });
      console.log('Deleted', old.length, 'old problems');
    }
  }

  console.log('Fetching Codeforces problemset...');
  var res = await fetch('https://codeforces.com/api/problemset.problems');
  if (!res.ok) { console.error('HTTP', res.status); process.exit(1); }
  var json = await res.json();
  if (json.status !== 'OK') { console.error('CF:', json.status); process.exit(1); }
  var problems = json.result.problems, stats = json.result.problemStatistics;
  console.log('Got', problems.length, 'problems');

  var sm = new Map();
  for (var i = 0; i < stats.length; i++) { sm.set(stats[i].contestId + ':' + stats[i].index, stats[i].solvedCount); }

  var cnd = [], inter = 0;
  for (var i = 0; i < problems.length; i++) {
    var p = problems[i], tags = (p.tags||[]).map(function(t){return t.trim().toLowerCase();});
    if (tags.indexOf('interactive') >= 0) { inter++; continue; }
    cnd.push({cid:p.contestId, idx:p.index, name:p.name, rating:p.rating, tags:tags, solved:sm.get(p.contestId+':'+p.index)});
  }
  console.log('Interactive excluded:', inter);
  console.log('Candidates:', cnd.length);

  if (DRY_RUN) {
    var byTag = {};
    for (var i = 0; i < cnd.length; i++) {
      for (var j = 0; j < cnd[i].tags.length; j++) { byTag[cnd[i].tags[j]] = (byTag[cnd[i].tags[j]]||0)+1; }
    }
    var top = Object.entries(byTag).sort(function(a,b){return b[1]-a[1];}).slice(0,20);
    console.log('Top 20 tags:', top.map(function(e){return e[0]+'('+e[1]+')';}).join(', '));
    for (var i = 0; i < 5; i++) {
      var c = cnd[i];
      console.log('  cf'+c.cid+c.idx, c.name, c.rating||'unrated', '['+c.tags.slice(0,4).join(',')+']');
    }
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log('Loading existing for dedup...');
  var existing = await prisma.problem.findMany({ where: { source: { contains: 'codeforces' } }, select: { id:true, title:true, metadata:true }, take: 30000 });
  var ek = new Set();
  for (var i = 0; i < existing.length; i++) {
    var m = existing[i].metadata;
    if (m && typeof m === 'object' && !Array.isArray(m) && typeof m.externalId === 'string') ek.add(m.externalId);
    ek.add('T:' + existing[i].title.trim().toLowerCase());
  }
  console.log('Dedup keys:', ek.size);

  var created = 0, existed = 0, failed = 0, TOTAL = cnd.length, BATCH = 50, start = Date.now();

  for (var i = 0; i < TOTAL; i += BATCH) {
    var batch = cnd.slice(i, i+BATCH), bn = Math.floor(i/BATCH)+1, tb = Math.ceil(TOTAL/BATCH);
    try {
      await prisma.$transaction(async function(tx) {
        for (var j = 0; j < batch.length; j++) {
          var c = batch[j], extId = 'codeforces:'+c.cid+':'+c.idx, tKey = 'T:'+c.name.trim().toLowerCase();
          if (ek.has(extId) || ek.has(tKey)) { existed++; continue; }
          var url = 'https://codeforces.com/problemset/problem/'+c.cid+'/'+c.idx;
          var dif; if (c.rating==null) dif='UNKNOWN'; else if (c.rating<1200) dif='EASY'; else if (c.rating<1700) dif='MEDIUM'; else if (c.rating<2200) dif='HARD'; else dif='CHALLENGE';
          var stmt = '# '+c.name+'\n\n## Codeforces\n'+url+'\n\n元数据仅含标签/难度，不含完整题面。';
          try {
            await tx.problem.create({ data: {
              title: c.name.slice(0,500), description: stmt.slice(0,500), difficulty: dif,
              tags: c.tags.slice(0,12), source: 'external-dev:codeforces:cf'+c.cid+c.idx, sourceUrl: url,
              metadata: { provider:'codeforces', externalId:extId, externalProblemId:extId, providerId:'codeforces',
                contestId:c.cid, index:c.idx, rating:c.rating, tags:c.tags, solvedCount:c.solved,
                sourceUrl:url, statement:stmt, inputDescription:'参见原题', outputDescription:'参见原题',
                examples:[], constraints:'参见原题', warnings:['仅元数据'], importMethod:'cf-mass',
                noFullStatement:true, importedAt:new Date().toISOString(), productionReady:false }
            }});
            ek.add(extId); ek.add(tKey); created++;
          } catch(e) {
            if (e.code==='P2002' || (e.message||'').indexOf('Unique')>=0) { ek.add(extId); ek.add(tKey); existed++; }
            else { failed++; }
          }
        }
      }, { timeout: 60000 });

      var el = ((Date.now()-start)/1000).toFixed(1);
      console.log('  ['+bn+'/'+tb+'] '+(Math.min(i+BATCH,TOTAL)/TOTAL*100).toFixed(1)+'% | +'+created+' ~'+existed+' x'+failed+' | '+el+'s');
    } catch(e) {
      console.error('  Batch '+bn+' failed:', e.message);
      failed += batch.length;
    }
  }

  var tt = ((Date.now()-start)/1000).toFixed(1);
  console.log('\nDone: +'+created+' ~'+existed+' x'+failed+' in '+tt+'s');
  await prisma.$disconnect();
}

main().catch(function(e) { console.error('Fatal:', e.message); process.exit(1); });
