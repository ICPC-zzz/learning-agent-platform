// Desktop Reader 写入前置预检（Write Preflight）本地预览面板
//
// Status: preview-only / local-only / read-only / disabled-by-default

const WRITE_PREFLIGHT_STORAGE_KEY = "lap.reader.writePreflight.preview";
const SAFE_WRITE_PREFLIGHT_COPY =
  "开发预览 / 只读 / 真实写入未启用 / 生产默认关闭 / 不会调用 repository";

function normalizeNullableString(value) {
  if (typeof value !== "string") { return null; }
  var n = value.trim();
  return n.length > 0 ? n : null;
}

function normalizeDisplayString(value, maxLength) {
  var n = normalizeNullableString(value);
  if (!n) { return null; }
  if (typeof maxLength !== "number" || !Number.isFinite(maxLength) || maxLength <= 0) { return n; }
  if (n.length <= maxLength) { return n; }
  return n.slice(0, Math.max(0, maxLength - 3)) + "...";
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBoolean(value) {
  return typeof value === "boolean";
}

const SENSITIVE_FIELD_PATTERNS = [
  "token", "cookie", "session", "authorization", "apikey", "secret",
  "databaseurl", "rawrequest", "rawbody", "rawheaders", "rawdbrecord",
  "rawuserid", "password", "accesstoken", "refreshtoken",
];

function normalizeSafeKey(rawKey) {
  if (typeof rawKey !== "string") { return ""; }
  return rawKey.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveFieldName(rawKey) {
  var n = normalizeSafeKey(rawKey);
  if (!n) { return false; }
  for (var i = 0; i < SENSITIVE_FIELD_PATTERNS.length; i += 1) {
    if (n === SENSITIVE_FIELD_PATTERNS[i] ||
        (SENSITIVE_FIELD_PATTERNS[i].length > 4 && n.indexOf(SENSITIVE_FIELD_PATTERNS[i]) !== -1)) {
      return true;
    }
  }
  return false;
}

function collectSensitiveFieldHits(value, path, hits) {
  var cp = Array.isArray(path) ? path : [];
  var ch = Array.isArray(hits) ? hits : [];
  if (!isRecord(value) && !Array.isArray(value)) { return ch; }
  if (Array.isArray(value)) {
    for (var i = 0; i < value.length; i += 1) { collectSensitiveFieldHits(value[i], cp.concat(String(i)), ch); }
    return ch;
  }
  var ks = Object.keys(value);
  for (var j = 0; j < ks.length; j += 1) {
    var k = ks[j];
    var np = cp.concat(k);
    if (isSensitiveFieldName(k)) { ch.push(np.join(".")); }
    collectSensitiveFieldHits(value[k], np, ch);
  }
  return ch;
}

function normalizeBooleanDisplay(value) {
  if (value === undefined || value === null) { return "未提供"; }
  if (typeof value === "boolean") { return String(value); }
  return "类型错误";
}

function normalizeWritePreflightPreviewRecord(value) {
  if (!isRecord(value)) { return null; }
  var sh = collectSensitiveFieldHits(value);
  var ar = normalizeBooleanDisplay(value.authReady);
  var pg = normalizeBooleanDisplay(value.permissionGateReady);
  var ir = normalizeBooleanDisplay(value.idempotencyReady);
  var au = normalizeBooleanDisplay(value.auditReady);
  var dw = normalizeBooleanDisplay(value.databaseWriteOptIn);
  var pr = normalizeBooleanDisplay(value.publicRouteExposed);
  var rpwr = isBoolean(value.productionWriteReady) ? value.productionWriteReady : null;
  var pwrText = rpwr === true ? "true（仅本地预览字段，不代表真实写入已启用）" : (rpwr === false ? "false" : "未提供");
  var rwd = isBoolean(value.writesDatabase) ? value.writesDatabase : null;
  var rcr = isBoolean(value.callsRepository) ? value.callsRepository : null;
  var wdWarn = null;
  if (rwd === true) { wdWarn = "安全警告：本地 mock 数据 writesDatabase=true，真实写入未启用，请勿依赖此字段作为生产判断依据。"; }
  var crWarn = null;
  if (rcr === true) { crWarn = "安全警告：本地 mock 数据 callsRepository=true，真实 repository 未被调用，请勿依赖此字段作为生产判断依据。"; }
  var wdText = rwd === true ? "true（安全警告：真实写入未启用）" : (rwd === false ? "false" : "未提供");
  var crText = rcr === true ? "true（安全警告：真实 repository 未调用）" : (rcr === false ? "false" : "未提供");
  var brText = Array.isArray(value.blockedReasons)
    ? value.blockedReasons.filter(function (r) { return typeof r === "string" && r.trim().length > 0; }).join("; ") || "无"
    : "未提供";
  var stText = normalizeDisplayString(value.status, 40) || "blocked";
  var hp = (value.previewOnly !== undefined && value.previewOnly !== true);
  var mii = hp || wdWarn || crWarn;
  return {
    authReady: ar, permissionGateReady: pg, idempotencyReady: ir, auditReady: au,
    databaseWriteOptIn: dw, publicRouteExposed: pr, productionWriteReadyText: pwrText,
    writesDatabaseText: wdText, callsRepositoryText: crText,
    writesDatabaseWarning: wdWarn, callsRepositoryWarning: crWarn,
    blockedReasonsText: brText, previewOnlyText: "true", statusText: stText,
    sensitiveText: sh.length > 0 ? "已过滤敏感字段" : "-",
    degradedText: mii ? "预检数据结构不完整或包含安全风险标记，已安全降级" : null,
  };
}

function readWritePreflightPreviewFromStorage(storage) {
  if (!storage) {
    return { stateKind: "unavailable", statusText: "本地写入预检预览数据不可用", noteText: SAFE_WRITE_PREFLIGHT_COPY, hintText: "当前环境无法读取 localStorage，已安全降级。", filteredText: null, record: null };
  }
  var rv = null;
  try { rv = storage.getItem(WRITE_PREFLIGHT_STORAGE_KEY); }
  catch (_e) { return { stateKind: "unavailable", statusText: "本地写入预检预览数据不可用", noteText: SAFE_WRITE_PREFLIGHT_COPY, hintText: "当前环境无法读取 localStorage，已安全降级。", filteredText: null, record: null }; }
  if (rv === null) {
    return { stateKind: "empty", statusText: "暂无本地写入预检预览", noteText: SAFE_WRITE_PREFLIGHT_COPY, hintText: "请在 localStorage 中写入 lap.reader.writePreflight.preview 后点击刷新。", filteredText: null, record: null };
  }
  var pv = null;
  try { pv = JSON.parse(rv); }
  catch (_e) { return { stateKind: "degraded", statusText: "本地写入预检预览已安全降级", noteText: SAFE_WRITE_PREFLIGHT_COPY, hintText: "本地写入预检预览 JSON 不可解析，已安全降级。", filteredText: null, record: null }; }
  if (!isRecord(pv)) {
    return { stateKind: "degraded", statusText: "本地写入预检预览已安全降级", noteText: SAFE_WRITE_PREFLIGHT_COPY, hintText: "本地写入预检预览结构不兼容，已安全降级。", filteredText: null, record: null };
  }
  var sh = collectSensitiveFieldHits(pv);
  var ft = sh.length > 0 ? "已过滤敏感字段" : null;
  var rc = normalizeWritePreflightPreviewRecord(pv);
  if (!rc) {
    return { stateKind: "degraded", statusText: "本地写入预检预览已安全降级", noteText: SAFE_WRITE_PREFLIGHT_COPY, hintText: "本地写入预检预览记录无法安全展示，已安全降级。", filteredText: ft, record: null };
  }
  return { stateKind: "ready", statusText: "已读取本地写入预检预览", noteText: SAFE_WRITE_PREFLIGHT_COPY, hintText: "点击刷新可重新读取 localStorage。", filteredText: ft, record: rc };
}

function buildLocalReaderWritePreflightPreviewPanelScript() {
  return "(function () {\n" +
  "var K=" + JSON.stringify(WRITE_PREFLIGHT_STORAGE_KEY) + ";\n" +
  "var C=" + JSON.stringify(SAFE_WRITE_PREFLIGHT_COPY) + ";\n" +
  "var P=" + JSON.stringify(SENSITIVE_FIELD_PATTERNS) + ";\n" +
  "function isRecord(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}\n" +
  "function isBoolean(v){return typeof v==='boolean';}\n" +
  "function nns(v){if(typeof v!=='string')return null;var n=v.trim();return n.length>0?n:null;}\n" +
  "function nds(v,m){var n=nns(v);if(!n)return null;if(typeof m!=='number'||m<=0)return n;if(n.length<=m)return n;return n.slice(0,m-3)+'...';}\n" +
  "function nbd(v){if(v===undefined||v===null)return '未提供';if(typeof v==='boolean')return String(v);return '类型错误';}\n" +
  "function nsk(v){return typeof v==='string'?v.trim().toLowerCase().replace(/[^a-z0-9]/g,''):'';}\n" +
  "function iss(v){var n=nsk(v);if(!n)return false;for(var i=0;i<P.length;i++){if(n===P[i]||(P[i].length>4&&n.indexOf(P[i])!==-1))return true;}return false;}\n" +
  "function csh(v,p,h){var cp=Array.isArray(p)?p:[];var ch=Array.isArray(h)?h:[];if(!isRecord(v)&&!Array.isArray(v))return ch;if(Array.isArray(v)){for(var i=0;i<v.length;i++)csh(v[i],cp.concat(String(i)),ch);return ch;}var ks=Object.keys(v);for(var j=0;j<ks.length;j++){var k=ks[j];var np=cp.concat(k);if(iss(k))ch.push(np.join('.'));csh(v[k],np,ch);}return ch;}\n" +
  "function norm(v){if(!isRecord(v))return null;var sh=csh(v);var ar=nbd(v.authReady);var pg=nbd(v.permissionGateReady);var ir=nbd(v.idempotencyReady);var au=nbd(v.auditReady);var dw=nbd(v.databaseWriteOptIn);var pr=nbd(v.publicRouteExposed);var rpwr=isBoolean(v.productionWriteReady)?v.productionWriteReady:null;var pwrText=rpwr===true?'true（仅本地预览字段，不代表真实写入已启用）':(rpwr===false?'false':'未提供');var rwd=isBoolean(v.writesDatabase)?v.writesDatabase:null;var rcr=isBoolean(v.callsRepository)?v.callsRepository:null;var wdWarn=null;if(rwd===true)wdWarn='安全警告：本地 mock 数据 writesDatabase=true，真实写入未启用，请勿依赖此字段作为生产判断依据。';var crWarn=null;if(rcr===true)crWarn='安全警告：本地 mock 数据 callsRepository=true，真实 repository 未被调用，请勿依赖此字段作为生产判断依据。';var wdText=rwd===true?'true（安全警告：真实写入未启用）':(rwd===false?'false':'未提供');var crText=rcr===true?'true（安全警告：真实 repository 未调用）':(rcr===false?'false':'未提供');var brText=Array.isArray(v.blockedReasons)?v.blockedReasons.filter(function(r){return typeof r==='string'&&r.trim().length>0;}).join('; ')||'无':'未提供';var stText=nds(v.status,40)||'blocked';var hp=(v.previewOnly!==undefined&&v.previewOnly!==true);var mii=hp||wdWarn||crWarn;return{authReady:ar,permissionGateReady:pg,idempotencyReady:ir,auditReady:au,databaseWriteOptIn:dw,publicRouteExposed:pr,productionWriteReadyText:pwrText,writesDatabaseText:wdText,callsRepositoryText:crText,writesDatabaseWarning:wdWarn,callsRepositoryWarning:crWarn,blockedReasonsText:brText,previewOnlyText:'true',statusText:stText,sensitiveText:sh.length>0?'已过滤敏感字段':'-',degradedText:mii?'预检数据结构不完整或包含安全风险标记，已安全降级':null};}\n" +
  "function rs(){var s=null;try{s=window.localStorage;if(!s)return{sk:'unavailable',st:'本地写入预检预览数据不可用',nt:C,ht:'当前环境无法读取 localStorage，已安全降级。',ft:null,rc:null};}catch(e){return{sk:'unavailable',st:'本地写入预检预览数据不可用',nt:C,ht:'当前环境无法读取 localStorage，已安全降级。',ft:null,rc:null};}var rv=null;try{rv=s.getItem(K);}catch(e){return{sk:'unavailable',st:'本地写入预检预览数据不可用',nt:C,ht:'当前环境无法读取 localStorage，已安全降级。',ft:null,rc:null};}if(rv===null)return{sk:'empty',st:'暂无本地写入预检预览',nt:C,ht:'请在 localStorage 中写入 lap.reader.writePreflight.preview 后点击刷新。',ft:null,rc:null};var pv=null;try{pv=JSON.parse(rv);}catch(e){return{sk:'degraded',st:'本地写入预检预览已安全降级',nt:C,ht:'本地写入预检预览 JSON 不可解析，已安全降级。',ft:null,rc:null};}if(!isRecord(pv))return{sk:'degraded',st:'本地写入预检预览已安全降级',nt:C,ht:'本地写入预检预览结构不兼容，已安全降级。',ft:null,rc:null};var sh=csh(pv);var ft=sh.length>0?'已过滤敏感字段':null;var rc=norm(pv);if(!rc)return{sk:'degraded',st:'本地写入预检预览已安全降级',nt:C,ht:'本地写入预检预览记录无法安全展示，已安全降级。',ft:ft,rc:null};return{sk:'ready',st:'已读取本地写入预检预览',nt:C,ht:'点击刷新可重新读取 localStorage。',ft:ft,rc:rc};}\n" +
  "function ee(id,tag,par){var n=document.getElementById(id);if(n)return n;n=document.createElement(tag);n.id=id;if(par)par.appendChild(n);return n;}\n" +
  "var panel=document.getElementById('desktop-reader-write-preflight-preview-panel');\n" +
  "if(!panel){panel=document.createElement('section');panel.id='desktop-reader-write-preflight-preview-panel';panel.setAttribute('aria-live','polite');panel.style.marginTop='12px';panel.style.border='1px solid #d9dee7';panel.style.borderRadius='10px';panel.style.background='#f8fafc';panel.style.padding='12px';panel.style.boxShadow='0 1px 0 rgba(15,23,42,0.03)';var an=document.getElementById('desktop-reader-permission-gate-preview-panel')||document.getElementById('desktop-reader-audit-preview-panel')||document.getElementById('desktop-home-learning-action-card')||document.getElementById('desktop-home-bookmark-preview-card')||document.getElementById('desktop-navigation-shell');if(an&&an.parentNode){if(an.nextSibling)an.parentNode.insertBefore(panel,an.nextSibling);else an.parentNode.appendChild(panel);}else document.body.appendChild(panel);}\n" +
  "var tn=ee('desktop-reader-write-preflight-preview-title','p',panel);tn.style.margin='0';tn.style.fontWeight='600';tn.textContent='Reader 写入预检（本地预览）';\n" +
  "var nn=ee('desktop-reader-write-preflight-preview-note','p',panel);nn.style.marginTop='6px';nn.style.color='#5b6473';nn.style.fontSize='13px';nn.textContent=C;\n" +
  "var sn=ee('desktop-reader-write-preflight-preview-status','p',panel);sn.style.marginTop='6px';sn.style.fontWeight='600';\n" +
  "var hn=ee('desktop-reader-write-preflight-preview-hint','p',panel);hn.style.marginTop='6px';hn.style.color='#5b6473';hn.style.fontSize='13px';\n" +
  "var fn=ee('desktop-reader-write-preflight-preview-filtered','p',panel);fn.style.marginTop='6px';fn.style.color='#5b6473';fn.style.fontSize='13px';fn.style.fontWeight='600';\n" +
  "var wn=ee('desktop-reader-write-preflight-preview-warning','p',panel);wn.style.marginTop='10px';wn.style.background='#fff8e1';wn.style.border='1px solid #f3d06b';wn.style.color='#7a5600';wn.style.borderRadius='8px';wn.style.padding='10px 12px';wn.style.fontSize='13px';wn.style.display='none';\n" +
  "var bn=ee('desktop-reader-write-preflight-preview-refresh-button','button',panel);bn.type='button';bn.textContent='刷新本地写入预检预览';bn.style.display='inline-flex';bn.style.alignItems='center';bn.style.justifyContent='center';bn.style.border='1px solid #d9dee7';bn.style.borderRadius='8px';bn.style.background='#ffffff';bn.style.color='#1f2937';bn.style.fontWeight='600';bn.style.fontSize='14px';bn.style.minHeight='38px';bn.style.padding='0 14px';bn.style.cursor='pointer';bn.style.marginTop='10px';\n" +
  "var dn=ee('desktop-reader-write-preflight-preview-details','ul',panel);dn.style.marginTop='12px';dn.style.listStyle='none';dn.style.paddingLeft='0';dn.style.display='grid';dn.style.gap='8px';\n" +
  "function buildRow(l,v){var li=document.createElement('li');li.style.display='grid';li.style.gridTemplateColumns='200px 1fr';li.style.gap='8px';li.style.fontSize='14px';var ls=document.createElement('span');ls.style.color='#5b6473';ls.textContent=l;var vs=document.createElement('strong');vs.textContent=String(v);li.appendChild(ls);li.appendChild(vs);return li;}\n" +
  "function render(){var s=rs();sn.textContent=s.st;hn.textContent=s.ht;fn.textContent=s.ft||'';dn.innerHTML='';wn.style.display='none';wn.textContent='';if(!s.rc){var el=document.createElement('li');el.style.color='#5b6473';el.textContent='暂无写入预检数据';dn.appendChild(el);return s;}var r=s.rc;var rows=[['authReady',r.authReady],['permissionGateReady',r.permissionGateReady],['idempotencyReady',r.idempotencyReady],['auditReady',r.auditReady],['databaseWriteOptIn',r.databaseWriteOptIn],['publicRouteExposed',r.publicRouteExposed],['productionWriteReady',r.productionWriteReadyText],['writesDatabase',r.writesDatabaseText],['callsRepository',r.callsRepositoryText],['blockedReasons',r.blockedReasonsText],['previewOnly',r.previewOnlyText],['status',r.statusText],['敏感字段',r.sensitiveText]];if(r.degradedText)rows.push(['降级',r.degradedText]);for(var i=0;i<rows.length;i++)dn.appendChild(buildRow(rows[i][0],rows[i][1]));var ws=[];if(r.writesDatabaseWarning)ws.push(r.writesDatabaseWarning);if(r.callsRepositoryWarning)ws.push(r.callsRepositoryWarning);if(ws.length>0){wn.textContent=ws.join(' ');wn.style.display='block';}return s;}\n" +
  "bn.onclick=function(){render();};\n" +
  "render();\n" +
  "return true;\n" +
  "})();";
}

module.exports = {
  WRITE_PREFLIGHT_STORAGE_KEY,
  SAFE_WRITE_PREFLIGHT_COPY,
  normalizeBooleanDisplay,
  collectSensitiveFieldHits,
  normalizeWritePreflightPreviewRecord,
  readWritePreflightPreviewFromStorage,
  buildLocalReaderWritePreflightPreviewPanelScript,
};
