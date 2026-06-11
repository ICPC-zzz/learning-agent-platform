const B="/sessions/optimistic-laughing-gates/mnt/learning-agent-platform";
var p=0,f=0;var G="\x1b[32m",R="\x1b[31m",Z="\x1b[0m";
function a(c,l){if(c){p++;console.log(G+"PASS"+Z+" "+l);}else{f++;console.log(R+"FAIL"+Z+" "+l);}}
function ae(x,y,l){if(x===y){p++;console.log(G+"PASS"+Z+" "+l);}else{f++;console.log(R+"FAIL"+Z+" "+l);}}
function ac(t,n,l){if(t.indexOf(n)>=0){p++;console.log(G+"PASS"+Z+" "+l);}else{f++;console.log(R+"FAIL"+Z+" "+l);}}

var SR=await import(B+"/packages/ai-core/src/llm/llm-safe-result.ts");
var CT=await import(B+"/packages/ai-core/src/llm/llm-provider-contract.ts");
var MP=await import(B+"/packages/ai-core/src/llm/mock-llm-provider.ts");
var EP=await import(B+"/packages/ai-core/src/llm/external-chat-completions-provider.ts");
var GD=await import(B+"/apps/web/src/app/reader/reader-ai-qa-guard.ts");
var CX=await import(B+"/apps/web/src/app/reader/reader-ai-qa-context.ts");
var VM=await import(B+"/apps/web/src/app/reader/reader-ai-qa-view-model.ts");

//===Contract===console.log("===Contract===");
ae(CT.LlmProviderMode.Mock,"mock","mode");ae(CT.LlmProviderMode.ExternalDevOnly,"external-dev-only","ext");

//===SafeResult===console.log("===SafeResult===");
var sr=SR.createSafeResult({answerSummary:"S",providerMode:"mock",realProviderCalled:false,networkAccessed:false});
a(sr.ok,"ok");a(sr.secretSafe,"sec");a(!sr.rawPromptStored,"!rp");a(sr.devOnly,"dev");a(!sr.productionReady,"!pr");
var s1=SR.createSafeResult({answerSummary:"api_key=sk-x bearer y",providerMode:"mock",realProviderCalled:false,networkAccessed:false});
a(s1.answerSummary.indexOf("sk-x")<0,"red1");
var s2=SR.createSafeResult({answerSummary:"DATABASE_URL=pg://x",providerMode:"mock",realProviderCalled:false,networkAccessed:false});
a(s2.answerSummary.indexOf("pg://")<0,"red2");
var br=SR.createBlockedResult(["r"],"external-dev-only");a(!br.ok,"br");ac(br.answerSummary,"blocked","brT");

//===Mock===console.log("===Mock===");
var mp=new MP.MockLlmProvider();ae(mp.mode,"mock","mm");
var mr=await mp.generate({messages:[{role:CT.LlmChatRole.User,content:"What is recursion?"}],purposeSummary:"t"});
a(mr.ok,"mo");a(!mr.realProviderCalled,"mr");a(!mr.networkAccessed,"mn");ac(mr.answerSummary,"Mock Provider","ml");
a(!(await mp.generate({messages:[],purposeSummary:"t"})).ok,"me");
a(!(await mp.generate({messages:[{role:CT.LlmChatRole.User,content:"token abc"}],purposeSummary:"t"})).ok,"ms");
a(!(await mp.generate({messages:[{role:CT.LlmChatRole.User,content:"a".repeat(5000)}],maxInputChars:100,purposeSummary:"t"})).ok,"mx");

//===ExtCfg===console.log("===ExtCfg===");
var c1=EP.loadExternalProviderConfig({});a(!c1.configured,"!c");
var c2=EP.loadExternalProviderConfig({endpoint:"https://x.com/v1",apiKey:"k",model:"m"});a(c2.configured,"c");ae(c2.blockedReason,null,"!b");

//===ExtProv===console.log("===ExtProv===");
function ff(c){return async function(){return{ok:true,status:200,text:async function(){return JSON.stringify({choices:[{message:{role:"assistant",content:c}}]});}};};}
function ef(s){return async function(){return{ok:false,status:s,text:async function(){return JSON.stringify({error:"x"});}};};}
var er=await(new EP.ExternalChatCompletionsProvider(c2,ff("Hello!"))).generate({messages:[{role:CT.LlmChatRole.User,content:"Hi"}],purposeSummary:"t"});
a(er.ok,"eo");a(er.realProviderCalled,"er");ac(er.answerSummary,"Hello!","ea");
ae((await(new EP.ExternalChatCompletionsProvider(c2,ef(401))).generate({messages:[{role:CT.LlmChatRole.User,content:"Hi"}],purposeSummary:"t"})).error.kind,"provider_disabled","e4");
a((await(new EP.ExternalChatCompletionsProvider(c2,ef(500))).generate({messages:[{role:CT.LlmChatRole.User,content:"Hi"}],purposeSummary:"t"})).error.retryable,"e5");
var esr=await(new EP.ExternalChatCompletionsProvider(c2,ff("api_key=sk-x"))).generate({messages:[{role:CT.LlmChatRole.User,content:"?"}],purposeSummary:"t"});
a(esr.answerSummary.indexOf("sk-x")<0,"es");

//===Guard===console.log("===Guard===");
var g1=GD.evaluateReaderAiQaGuard({});ae(g1.mode,"blocked","g1");
var g2=GD.evaluateReaderAiQaGuard({LAP_READER_AI_QA_DEV_ENABLED:"true"});ae(g2.mode,"mock_only","g2");
var g3=GD.evaluateReaderAiQaGuard({LAP_READER_AI_QA_DEV_ENABLED:"true",LAP_LLM_DEV_PROVIDER_ENABLED:"true",LAP_LLM_DEV_ENDPOINT:"https://x.com",LAP_LLM_DEV_API_KEY:"k",LAP_LLM_DEV_MODEL:"m"});
ae(g3.mode,"external_dev","g3");a(g3.allowExternalDev,"g3e");
[g1,g2,g3].forEach(function(r,i){a(r.devOnly,"d"+i);a(!r.productionReady,"p"+i);});

//===Context===console.log("===Context===");
var cx1=CX.buildReaderAiQaContext({bookTitle:"B",chapterTitle:"C",chapterContent:"X",userQuestion:"?"});a(cx1.context!==null,"c1");
var cx2=CX.buildReaderAiQaContext({bookTitle:"B",chapterTitle:"C",chapterContent:"X",userQuestion:"   "});a(cx2.context===null,"c2");
var cx3=CX.buildReaderAiQaContext({bookTitle:"B",chapterTitle:"C",chapterContent:"token abc",userQuestion:"t?"});ac(cx3.context.safePromptPreview,"[token_redacted]","c3");
var cx4=CX.buildReaderAiQaContext({bookTitle:"B",chapterTitle:"C",chapterContent:"DATABASE_URL=pg://x",userQuestion:"d?"});ac(cx4.context.safePromptPreview,"[DATABASE_URL_redacted]","c4");
var cx5=CX.buildReaderAiQaContext({bookTitle:"B",chapterTitle:"C",chapterContent:"api_key=sk-1",userQuestion:"k?"});ac(cx5.context.safePromptPreview,"[api_key_redacted]","c5");
var cx6=CX.buildReaderAiQaContext({bookTitle:"B",chapterTitle:"C",chapterContent:"X",userQuestion:"x".repeat(2000)});a(cx6.context.questionTruncated,"c6");
var cx7=CX.buildReaderAiQaContext({bookTitle:"B",chapterTitle:"C",chapterContent:"A".repeat(20000),userQuestion:"s?"});a(cx7.context.chapterTruncated,"c7");

//===ViewModel===console.log("===ViewModel===");
var vm1=VM.buildReaderAiQaPanelViewModel({result:null,submitError:null,isSubmitting:false,question:""});ae(vm1.modeCssClass,"mock","v1");a(vm1.labelsSafe,"v1s");
var mrk={success:true,answerPreview:"A",providerMode:"mock",realProviderCalled:false,devOnly:true,productionReady:false,blockedReasons:[],safeToExposeToClient:{guardMode:"mock_only",guardNotice:"m",guardSourceLabel:"m",contextUsed:true,contextTruncated:false,sensitiveFieldsDetected:false,charCounts:{chapterOriginal:100,chapterTruncated:100,questionOriginal:10,questionTruncated:10,totalInput:200}},warnings:[]};
var vm2=VM.buildReaderAiQaPanelViewModel({result:mrk,submitError:null,isSubmitting:false,question:"t"});ae(vm2.modeCssClass,"mock","v2");
var blk={success:false,answerPreview:"b",providerMode:"blocked",realProviderCalled:false,devOnly:true,productionReady:false,blockedReasons:["r"],safeToExposeToClient:{guardMode:"blocked",guardNotice:"b",guardSourceLabel:"b",contextUsed:false,contextTruncated:false,sensitiveFieldsDetected:false,charCounts:null},warnings:[]};
var vm3=VM.buildReaderAiQaPanelViewModel({result:blk,submitError:null,isSubmitting:false,question:"t"});ae(vm3.modeCssClass,"blocked","v3");a(vm3.inputDisabled,"v3i");
a(!VM.hasForbiddenAIClaims("dev preview mock"),"vf1");a(VM.hasForbiddenAIClaims("生产 AI 已接入"),"vf2");
a(VM.checkLabels("开发预览 mock 默认").safe,"vs1");a(!VM.checkLabels("生产 AI 已接入 Agent 已运行").safe,"vs2");
a(VM.isServerActionResultSafe(mrk).safe,"vrs");
[vm1,vm2,vm3].forEach(function(v,i){var t=[v.eyebrowLabel,v.modeLabel,v.modeDescription,v.submitLabel].join(" ");a(!VM.hasForbiddenAIClaims(t),"vc"+i);});

console.log("\n"+p+" pass / "+f+" fail");process.exit(f>0?1:0);
