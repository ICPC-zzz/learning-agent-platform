import * as VM from "./user-ai-history-page-view-model.ts";
var GREEN="\x1b[32m";var RED="\x1b[31m";var RESET="\x1b[0m";
var p=0;var f=0;var fai=[];
function a(c,l){if(c){p++;console.log(GREEN+"  PASS"+RESET+" "+l);}else{f++;var m="FAIL: "+l;fai.push(m);console.log(RED+"  "+m+RESET);}}
function ae(x,y,l){if(x===y){p++;console.log(GREEN+"  PASS"+RESET+" "+l);}else{f++;var m="FAIL: "+l+" expected "+JSON.stringify(y)+" got "+JSON.stringify(x);fai.push(m);console.log(RED+"  "+m+RESET);}}

var dbItem={id:"db1",bookId:"b1",chapterId:"c1",bookTitle:"B",chapterTitle:"C",questionPreview:"Q",answerPreview:"A",providerMode:"mock",realProviderCalled:false,codeBlockCount:2,createdAt:"2026-06-01T00:00:00Z"};
var localItem={historyId:"l1",bookId:"b2",chapterId:"c2",bookTitle:"B2",chapterTitle:"C2",questionPreview:"Q2",answerPreview:"A2",providerMode:"mock",realProviderCalled:false,codeBlockCount:1,createdAt:"2026-06-02T00:00:00Z"};

console.log("\n--- DB + local combined ---");
var r0=VM.buildUserAiHistoryPageViewModel({dbItems:[dbItem],localItems:[localItem],dbGuardEnabled:true,blockedReasons:[]});
a(r0.hasHistory,"has history");
ae(r0.totalCount,2,"total 2");
ae(r0.dbCount,1,"db count 1");
ae(r0.localCount,1,"local count 1");
a(r0.items[0].readerLink.indexOf("/reader?")>=0,"has reader link");

console.log("\n--- DB only ---");
var r1=VM.buildUserAiHistoryPageViewModel({dbItems:[dbItem],localItems:[],dbGuardEnabled:true,blockedReasons:[]});
ae(r1.totalCount,1,"db only total 1");

console.log("\n--- Local only ---");
var r2=VM.buildUserAiHistoryPageViewModel({dbItems:[],localItems:[localItem],dbGuardEnabled:false,blockedReasons:["disabled"]});
ae(r2.totalCount,1,"local only total 1");
ae(r2.dataSourceLabel,"本地存储","local label");
a(r2.guardBlockedReasons.length>0,"has blocked reasons");

console.log("\n--- Empty ---");
var r3=VM.buildUserAiHistoryPageViewModel({dbItems:[],localItems:[],dbGuardEnabled:false,blockedReasons:[]});
ae(r3.totalCount,0,"empty total 0");
a(!r3.hasHistory,"no history");

console.log("\n--- Safety check ---");
a(VM.aiHistoryPageSafe(r0),"safe");
a(VM.aiHistoryPageSafe(r1),"safe");
a(VM.aiHistoryPageSafe(r2),"safe");
a(VM.aiHistoryPageSafe(r3),"safe");

console.log("\n--- Sort by createdAt desc ---");
var r4=VM.buildUserAiHistoryPageViewModel({dbItems:[{...dbItem,id:"d1",createdAt:"2026-01-01"}],localItems:[{...localItem,historyId:"l1",createdAt:"2026-06-01"}],dbGuardEnabled:true,blockedReasons:[]});
a(r4.items[0].createdAt>r4.items[1].createdAt,"sorted newest first");

console.log("\n"+"=".repeat(40));
console.log("Page VM: "+p+" pass / "+f+" fail");
if(fai.length>0){for(var fi=0;fi<fai.length;fi++)console.log("  "+fai[fi]);}
process.exit(f>0?1:0);
