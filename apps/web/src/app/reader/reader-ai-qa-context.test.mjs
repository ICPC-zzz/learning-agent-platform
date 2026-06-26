import * as ctx from "./reader-ai-qa-context.ts";
var GREEN="\x1b[32m";var RED="\x1b[31m";var YELLOW="\x1b[33m";var RESET="\x1b[0m";
var p=0;var f=0;var failures=[];
function a(c,l){if(c){p++;console.log(GREEN+"  PASS"+RESET+" "+l);}else{f++;var m="FAIL: "+l;failures.push(m);console.log(RED+"  "+m+RESET);}}
function ae(x,y,l){if(x===y){p++;console.log(GREEN+"  PASS"+RESET+" "+l);}else{f++;var m="FAIL: "+l+" expected "+JSON.stringify(y)+" got "+JSON.stringify(x);failures.push(m);console.log(RED+"  "+m+RESET);}}
function ac(t,n,l){if(t.indexOf(n)>=0){p++;console.log(GREEN+"  PASS"+RESET+" "+l);}else{f++;var m="FAIL: "+l+" - not found: "+n;failures.push(m);console.log(RED+"  "+m+RESET);}}

console.log("\n--- Basic context ---");
var r1=ctx.buildReaderAiQaContext({bookTitle:"Test Book",chapterTitle:"Ch1",chapterContent:"Chapter content.",userQuestion:"What is this?"});
a(r1.context!==null,"basic built");a(r1.blockedReason===null,"no blocked");
ae(r1.context.bookTitle,"Test Book","title preserved");ae(r1.context.chapterTitle,"Ch1","chap preserved");
a(!r1.context.chapterTruncated,"not truncated");a(!r1.context.questionTruncated,"q not truncated");
a(!r1.context.sensitiveFieldsDetected,"no sensitive");

console.log("\n--- Empty question blocked ---");
var r2=ctx.buildReaderAiQaContext({bookTitle:"T",chapterTitle:"C",chapterContent:"X",userQuestion:"   "});
a(r2.context===null,"empty blocked");ac(r2.blockedReason,"不能为空","reason empty");

console.log("\n--- Question truncated ---");
var lq="x".repeat(1500);
var r3=ctx.buildReaderAiQaContext({bookTitle:"T",chapterTitle:"C",chapterContent:"X",userQuestion:lq});
a(r3.context!==null,"long q built");a(r3.context.questionTruncated,"q truncated");
ae(r3.context.userQuestion.length,ctx.READER_AI_QA_LIMITS.MAX_QUESTION_CHARS,"q at max");

console.log("\n--- Chapter truncated ---");
var lc="Content here. ".repeat(2000);
var r4=ctx.buildReaderAiQaContext({bookTitle:"T",chapterTitle:"Long",chapterContent:lc,userQuestion:"Summary?"});
a(r4.context!==null,"long ch built");a(r4.context.chapterTruncated,"ch truncated");
a(r4.context.chapterExcerpt.indexOf("...")>0,"has ...");a(r4.context.chapterExcerpt.length<=ctx.READER_AI_QA_LIMITS.MAX_CHAPTER_CHARS,"within limit");

console.log("\n--- Sensitive: token ---");
var r5=ctx.buildReaderAiQaContext({bookTitle:"Test",chapterTitle:"Ch1",chapterContent:"my token is abc123",userQuestion:"what is token?"});
a(r5.context!==null,"built");a(r5.context.sensitiveFieldsDetected,"sensitive detected");
a(r5.context.detectedPatterns.indexOf("token")>=0,"token pattern");
ac(r5.context.safePromptPreview,"[token_redacted]","token keyword redacted");

console.log("\n--- Sensitive: DATABASE_URL ---");
var r6=ctx.buildReaderAiQaContext({bookTitle:"Test",chapterTitle:"Ch1",chapterContent:"DATABASE_URL=postgres://user:pass@localhost/db",userQuestion:"how to connect?"});
a(r6.context.sensitiveFieldsDetected,"sensitive detected");
a(r6.context.detectedPatterns.indexOf("DATABASE_URL")>=0,"DATABASE_URL pattern");
ac(r6.context.safePromptPreview,"[DATABASE_URL_redacted]","DATABASE_URL redacted");
a(r6.context.safePromptPreview.indexOf("postgres://")<0,"value redacted too");

console.log("\n--- Sensitive: api_key ---");
var r7=ctx.buildReaderAiQaContext({bookTitle:"Test",chapterTitle:"Auth",chapterContent:"api_key=sk-12345 Authorization: Bearer token456",userQuestion:"how to call API?"});
a(r7.context.sensitiveFieldsDetected,"multiple detected");
a(r7.context.detectedPatterns.indexOf("api_key")>=0,"api_key pattern");
a(r7.context.detectedPatterns.indexOf("authorization")>=0,"auth pattern");
ac(r7.context.safePromptPreview,"[api_key_redacted]","api_key redacted");
a(r7.context.safePromptPreview.indexOf("sk-12345")<0,"api value redacted");
a(r7.context.safePromptPreview.indexOf("token456")<0,"bearer value redacted");

console.log("\n--- Sensitive: password+secret+cookie ---");
var r8=ctx.buildReaderAiQaContext({bookTitle:"Test",chapterTitle:"Sec",chapterContent:"password=admin123 secret=s3cr3t cookie set",userQuestion:"how to protect?"});
a(r8.context.sensitiveFieldsDetected,"multiple detected");
a(r8.context.detectedPatterns.length>=2,"multiple patterns");

console.log("\n--- Code summaries ---");
var r9=ctx.buildReaderAiQaContext({bookTitle:"Prog",chapterTitle:"FP",chapterContent:"const add=(a,b)=>a+b;",codeBlockSummaries:["add: const add=(a,b)=>a+b","mul: const mul=(a,b)=>a*b"],userQuestion:"difference?"});
a(r9.context!==null,"built");ac(r9.context.safePromptPreview,"add:","first summary");ac(r9.context.safePromptPreview,"mul:","second summary");

console.log("\n--- Max code summaries ---");
var r10=ctx.buildReaderAiQaContext({bookTitle:"B",chapterTitle:"C",chapterContent:"X",codeBlockSummaries:["S1","S2","S3","S4","S5","S6","S7","S8","S9","S10"],userQuestion:"?"});
a(r10.context!==null,"built");ac(r10.context.safePromptPreview,"S1","first present");a(r10.context.safePromptPreview.indexOf("S6")<0,"S6 absent");

console.log("\n--- Total input too large ---");
var hc="A".repeat(ctx.READER_AI_QA_LIMITS.MAX_CHAPTER_CHARS);
var hq="B".repeat(ctx.READER_AI_QA_LIMITS.MAX_QUESTION_CHARS);
var r11=ctx.buildReaderAiQaContext({bookTitle:"T".repeat(200),chapterTitle:"C".repeat(200),chapterContent:hc,codeBlockSummaries:["S".repeat(500),"S2".repeat(500),"S3".repeat(500),"S4".repeat(500),"S5".repeat(500)],userQuestion:hq});
if(r11.context===null){ac(r11.blockedReason,"超过上限","too large blocked");}else{a(r11.context.charCounts.totalInput>0,"built with counts");}

console.log("\n--- Question sanitization ---");
var r12=ctx.buildReaderAiQaContext({bookTitle:"B",chapterTitle:"C",chapterContent:"normal",userQuestion:"what is api_key=xyz and token stuff?"});
a(r12.context!==null,"q built");a(r12.context.sensitiveFieldsDetected,"sensitive in q");
ac(r12.context.userQuestion,"[api_key_redacted]","api_key in q redacted");
ac(r12.context.userQuestion,"[token_redacted]","token in q redacted");

console.log("\n"+p+" pass / "+f+" fail");
if(failures.length>0){console.log("\n"+YELLOW+"Failures:"+RESET);failures.forEach(function(fi){console.log("  "+RED+fi+RESET);});}
process.exit(f>0?1:0);
