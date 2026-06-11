import * as VM from "./reader-ai-history-view-model.ts";
var GREEN="\x1b[32m";var RED="\x1b[31m";var RESET="\x1b[0m";
var p=0;var f=0;var fai=[];
function a(c,l){if(c){p++;console.log(GREEN+"  PASS"+RESET+" "+l);}else{f++;var m="FAIL: "+l;fai.push(m);console.log(RED+"  "+m+RESET);}}
function ae(x,y,l){if(x===y){p++;console.log(GREEN+"  PASS"+RESET+" "+l);}else{f++;var m="FAIL: "+l+" expected "+JSON.stringify(y)+" got "+JSON.stringify(x);fai.push(m);console.log(RED+"  "+m+RESET);}}

var items=[{historyId:"h1",questionPreview:"Q1?",answerPreview:"A1.",providerMode:"mock",realProviderCalled:false,codeBlockCount:2,createdAt:"2026-01-01T00:00:00Z",sourceType:"local"}];

console.log("\n--- Local data source ---");
var r0=VM.buildReaderAiHistoryPanelViewModel({items:items,dataSource:"local",dbGuardEnabled:false});
a(r0.hasHistory,"has history");
ae(r0.recentItems.length,1,"one recent");
ae(r0.recentItems[0].sourceLabel,"本地","local label");
ae(r0.totalCount,1,"total 1");
ac(r0.safetyNotice,"仅保存安全摘要","safety notice");

console.log("\n--- DB data source ---");
var r1=VM.buildReaderAiHistoryPanelViewModel({items:items,dataSource:"db",dbGuardEnabled:true});
ae(r1.dataSourceLabel,"开发 DB","db label");

console.log("\n--- No history ---");
var r2=VM.buildReaderAiHistoryPanelViewModel({items:[],dataSource:"none",dbGuardEnabled:false});
a(!r2.hasHistory,"no history");
ae(r2.recentItems.length,0,"zero recent");
ae(r2.totalCount,0,"zero total");

console.log("\n--- Max 3 recent items ---");
var many=[];
for(var i=0;i<10;i++){many.push({historyId:"h"+i,questionPreview:"Q"+i,answerPreview:"A"+i,providerMode:"mock",realProviderCalled:false,codeBlockCount:i,createdAt:"2026-0"+(i+1)+"-01T00:00:00Z",sourceType:"local"});}
var r3=VM.buildReaderAiHistoryPanelViewModel({items:many,dataSource:"local",dbGuardEnabled:false});
ae(r3.recentItems.length,VM.MAX_RECENT_ITEMS,"capped at max recent");

function ac(t,n,l){if(t.indexOf(n)>=0){p++;console.log(GREEN+"  PASS"+RESET+" "+l);}else{f++;var m="FAIL: "+l+" - not found: "+n;fai.push(m);console.log(RED+"  "+m+RESET);}}

console.log("\n"+"=".repeat(40));
console.log("History VM: "+p+" pass / "+f+" fail");
if(fai.length>0){for(var fi=0;fi<fai.length;fi++)console.log("  "+fai[fi]);}
process.exit(f>0?1:0);
