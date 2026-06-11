import * as CC from "./reader-ai-code-context.ts";
var GREEN="\x1b[32m";var RED="\x1b[31m";var YELLOW="\x1b[33m";var RESET="\x1b[0m";
var p=0;var f=0;var failures=[];
function a(c,l){if(c){p++;console.log(GREEN+"  PASS"+RESET+" "+l);}else{f++;var m="FAIL: "+l;failures.push(m);console.log(RED+"  "+m+RESET);}}
function ae(x,y,l){if(x===y){p++;console.log(GREEN+"  PASS"+RESET+" "+l);}else{f++;var m="FAIL: "+l+" expected "+JSON.stringify(y)+" got "+JSON.stringify(x);failures.push(m);console.log(RED+"  "+m+RESET);}}
function ac(t,n,l){if(t.indexOf(n)>=0){p++;console.log(GREEN+"  PASS"+RESET+" "+l);}else{f++;var m="FAIL: "+l+" - not found: "+n;failures.push(m);console.log(RED+"  "+m+RESET);}}

console.log("\n--- Empty content ---");
var r0=CC.buildReaderAiCodeContext({chapterContent:""});
a(r0.codeBlockCount===0,"empty returns 0");
ae(r0.languageSummary,"无代码块","empty lang summary");
a(r0.codeBlockSummaries.length===0,"empty no summaries");
a(r0.safeToExposeToLlm,"empty safe");

console.log("\n--- No code blocks ---");
var r0b=CC.buildReaderAiCodeContext({chapterContent:"plain text.\n\nNo code."});
ae(r0b.codeBlockCount,0,"no blocks 0");

console.log("\n--- Single fenced code block ---");
var c1=["text","```python","def hello():","    print('hi')","```","more"].join("\n");
var r1=CC.buildReaderAiCodeContext({chapterContent:c1});
ae(r1.codeBlockCount,1,"one block");
ae(r1.codeBlockSummaries[0].language,"python","lang python");
ac(r1.languageSummary,"python","lang summary has python");

console.log("\n--- Multiple code blocks ---");
var c2=["```python","x=1","```","","```javascript","y=2","```"].join("\n");
var r2=CC.buildReaderAiCodeContext({chapterContent:c2});
ae(r2.codeBlockCount,2,"two blocks");

console.log("\n--- Max code block limit ---");
var blocks=[];
for(var i=0;i<15;i++){blocks.push("```go");blocks.push("func x"+i+"(){}");blocks.push("```");}
var r3=CC.buildReaderAiCodeContext({chapterContent:blocks.join("\n")});
ae(r3.codeBlockCount,15,"15 total");
ae(r3.codeBlockSummaries.length,CC.CODE_CONTEXT_LIMITS.MAX_CODE_BLOCKS,"capped at limit");

console.log("\n--- Long preview truncation ---");
var longCode="x".repeat(500);
var c4=["```javascript",longCode,"```"].join("\n");
var r4=CC.buildReaderAiCodeContext({chapterContent:c4});
a(r4.codeBlockSummaries[0].preview.length<=CC.CODE_CONTEXT_LIMITS.MAX_PREVIEW_CHARS+3,"preview truncated");

console.log("\n--- Sensitive DATABASE_URL ---");
var c5=["```env","DATABASE_URL=postgresql://x@localhost/db","```"].join("\n");
var r5=CC.buildReaderAiCodeContext({chapterContent:c5});
a(r5.codeBlockSummaries[0].containsSensitivePattern,"DATABASE_URL flagged");

console.log("\n--- Sensitive api key ---");
var c6=["```js","var API_KEY='sk-1234567890abcdef';","```"].join("\n");
var r6=CC.buildReaderAiCodeContext({chapterContent:c6});
a(r6.codeBlockSummaries[0].containsSensitivePattern,"api_key flagged");

console.log("\n--- Sensitive bearer ---");
var c7=["```bash","curl -H 'Authorization: Bearer abc123' https://x.com","```"].join("\n");
var r7=CC.buildReaderAiCodeContext({chapterContent:c7});
a(r7.codeBlockSummaries[0].containsSensitivePattern,"bearer flagged");

console.log("\n--- Empty code block ---");
var r8=CC.buildReaderAiCodeContext({chapterContent:"```python\n```"});
a(r8.codeBlockCount>=1,"empty block found");

console.log("\n--- Raw code not in preview ---");
var fullCode=["import os","import sys","def main():","    pass"].join("\n");
var r9=CC.buildReaderAiCodeContext({chapterContent:"```python\n"+fullCode+"\n```"});
a(r9.codeBlockSummaries[0].preview.length<fullCode.length,"preview shorter than full");

console.log("\n--- Language summary duplicates ---");
var c10=["```python","x=1","```","```python","y=2","```","```js","z=3","```"].join("\n");
var r10=CC.buildReaderAiCodeContext({chapterContent:c10});
ac(r10.languageSummary,"python","has python");
ac(r10.languageSummary,"js","has js");

console.log("\n--- Code block count uses total ---");
var mb=[];
for(var ii=0;ii<12;ii++){mb.push("```go");mb.push("func f"+ii+"(){}");mb.push("```");}
var r11=CC.buildReaderAiCodeContext({chapterContent:mb.join("\n")});
ae(r11.codeBlockCount,12,"total 12");
ae(r11.codeBlockSummaries.length,CC.CODE_CONTEXT_LIMITS.MAX_CODE_BLOCKS,"summaries capped");

console.log("\n--- Safe no issues ---");
var r12=CC.buildReaderAiCodeContext({chapterContent:"```python\ndef add(a,b):return a+b\n```"});
a(r12.safeToExposeToLlm,"safe");

console.log("\n--- Unknown language ---");
var r13=CC.buildReaderAiCodeContext({chapterContent:"```\ncode\n```"});
ae(r13.codeBlockSummaries[0].language,"unknown","unknown lang");

console.log("\n--- Cookie + password ---");
var r14=CC.buildReaderAiCodeContext({chapterContent:"```http\nCookie: sid=abc\n```"});
a(r14.codeBlockSummaries[0].containsSensitivePattern,"cookie flagged");

var r15=CC.buildReaderAiCodeContext({chapterContent:"```yaml\npassword: secret\n```"});
a(r15.codeBlockSummaries[0].containsSensitivePattern,"password flagged");

console.log("\n--- private_key ---");
var r16=CC.buildReaderAiCodeContext({chapterContent:"```\nprivate_key=-----BEGIN RSA PRIVATE KEY-----\n```"});
a(r16.codeBlockSummaries[0].containsSensitivePattern,"private key flagged");

console.log("\n--- blockedReasons recorded ---");
var r17=CC.buildReaderAiCodeContext({chapterContent:"```env\nDATABASE_URL=pg://x\n```"});
a(r17.blockedReasons.length>0,"reasons recorded");

console.log("\n--- buildSafeCodeBlockSummaryStrings ---");
var rs1=CC.buildSafeCodeBlockSummaryStrings(CC.buildReaderAiCodeContext({chapterContent:c1}));
ae(rs1.length,1,"one string");
ac(rs1[0],"[python","format language");
ac(rs1[0],"行]","format lines");
var rs2=CC.buildSafeCodeBlockSummaryStrings(CC.buildReaderAiCodeContext({chapterContent:"text"}));
ae(rs2.length,0,"empty strings");

console.log("\n--- Limits ---");
a(CC.CODE_CONTEXT_LIMITS.MAX_CODE_BLOCKS>0,"MAX_CODE_BLOCKS>0");
a(CC.CODE_CONTEXT_LIMITS.MAX_CODE_BLOCKS<=20,"MAX_CODE_BLOCKS<=20");
a(CC.CODE_CONTEXT_LIMITS.MAX_PREVIEW_CHARS>0,"MAX_PREVIEW_CHARS>0");
a(CC.CODE_CONTEXT_LIMITS.MAX_PREVIEW_CHARS<=500,"MAX_PREVIEW_CHARS<=500");
a(CC.CODE_CONTEXT_LIMITS.MAX_TOTAL_PREVIEW_CHARS>0,"MAX_TOTAL_PREVIEW_CHARS>0");
a(CC.CODE_CONTEXT_LIMITS.MAX_TOTAL_PREVIEW_CHARS<=5000,"MAX_TOTAL_PREVIEW_CHARS<=5000");

console.log("\n"+"=".repeat(40));
console.log("Code context: "+p+" pass / "+f+" fail");
if(failures.length>0){for(var fi=0;fi<failures.length;fi++)console.log("  "+failures[fi]);}
process.exit(f>0?1:0);
