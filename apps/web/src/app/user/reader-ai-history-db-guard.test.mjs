import * as G from "./reader-ai-history-db-guard.ts";
var GREEN="\x1b[32m";var RED="\x1b[31m";var RESET="\x1b[0m";
var p=0;var f=0;var fai=[];
function a(c,l){if(c){p++;console.log(GREEN+"  PASS"+RESET+" "+l);}else{f++;var m="FAIL: "+l;fai.push(m);console.log(RED+"  "+m+RESET);}}
function ae(x,y,l){if(x===y){p++;console.log(GREEN+"  PASS"+RESET+" "+l);}else{f++;var m="FAIL: "+l+" expected "+JSON.stringify(y)+" got "+JSON.stringify(x);fai.push(m);console.log(RED+"  "+m+RESET);}}

console.log("\n--- Default: all closed ---");
var r0=G.evaluateReaderAiHistoryDbGuard({});
a(r0.blocked,"default blocked");
a(r0.blockedReasons.length>0,"has blocked reasons");
a(r0.devOnly,"devOnly true");
a(!r0.productionReady,"not production ready");
a(!r0.canRead,"cannot read");
a(!r0.canWrite,"cannot write");

console.log("\n--- Missing DB integration ---");
var r1=G.evaluateReaderAiHistoryDbGuard({LAP_WEB_AUTH_DEV_ENABLED:"true",LAP_READER_AI_HISTORY_DB_DEV_ENABLED:"true",hasDevSession:true});
a(r1.blocked,"blocked without DB integration");

console.log("\n--- Missing DATABASE_URL ---");
var r2=G.evaluateReaderAiHistoryDbGuard({LAP_ALLOW_REAL_DB_INTEGRATION:"true",LAP_WEB_AUTH_DEV_ENABLED:"true",LAP_READER_AI_HISTORY_DB_DEV_ENABLED:"true",hasDevSession:true});
a(r2.blocked,"blocked without DATABASE_URL");

console.log("\n--- Missing auth ---");
var r3=G.evaluateReaderAiHistoryDbGuard({LAP_ALLOW_REAL_DB_INTEGRATION:"true",DATABASE_URL:"pg://x",LAP_READER_AI_HISTORY_DB_DEV_ENABLED:"true",hasDevSession:true});
a(r3.blocked,"blocked without auth");

console.log("\n--- History guard not enabled ---");
var r4=G.evaluateReaderAiHistoryDbGuard({LAP_ALLOW_REAL_DB_INTEGRATION:"true",DATABASE_URL:"pg://x",LAP_WEB_AUTH_DEV_ENABLED:"true",hasDevSession:true});
a(r4.blocked,"blocked without history guard");

console.log("\n--- Missing dev session ---");
var r5=G.evaluateReaderAiHistoryDbGuard({LAP_ALLOW_REAL_DB_INTEGRATION:"true",DATABASE_URL:"pg://x",LAP_WEB_AUTH_DEV_ENABLED:"true",LAP_READER_AI_HISTORY_DB_DEV_ENABLED:"true"});
a(r5.blocked,"blocked without dev session");

console.log("\n--- All enabled ---");
var r6=G.evaluateReaderAiHistoryDbGuard({LAP_ALLOW_REAL_DB_INTEGRATION:"true",DATABASE_URL:"pg://x",LAP_WEB_AUTH_DEV_ENABLED:"true",LAP_READER_AI_HISTORY_DB_DEV_ENABLED:"true",hasDevSession:true});
a(!r6.blocked,"not blocked when all enabled");
a(r6.enabled,"enabled");
a(r6.canRead,"can read");
a(r6.canWrite,"can write");
a(r6.devOnly,"devOnly");
a(!r6.productionReady,"!productionReady");

console.log("\n--- Boolean parsing ---");
var r7=G.evaluateReaderAiHistoryDbGuard({LAP_ALLOW_REAL_DB_INTEGRATION:"1",DATABASE_URL:"x",LAP_WEB_AUTH_DEV_ENABLED:"yes",LAP_READER_AI_HISTORY_DB_DEV_ENABLED:"TRUE",hasDevSession:true});
a(!r7.blocked,"1/yes/TRUE all work");

console.log("\n--- Guard closed blocks actions ---");
var r8=G.evaluateReaderAiHistoryDbGuard({});
a(r8.blocked,"guard closed blocks");

console.log("\n"+"=".repeat(40));
console.log("DB guard: "+p+" pass / "+f+" fail");
if(fai.length>0){for(var fi=0;fi<fai.length;fi++)console.log("  "+fai[fi]);}
process.exit(f>0?1:0);
