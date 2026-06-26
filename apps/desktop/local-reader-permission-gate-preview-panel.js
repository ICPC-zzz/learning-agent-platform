// Desktop Reader 同步权限门（Permission Gate）本地预览面板
//
// 职责:
//   - 从 localStorage 读取 lap.reader.permission.preview
//   - 展示安全字段（serverUserIdPreview 为掩码）
//   - 过滤危险字段
//   - 所有文案标注"开发预览 / 只读 / 未连接真实权限"
//   - 不写入、不上传、不同步、不接 DB/auth/LLM/网络
//
// Status: preview-only / local-only / read-only / disabled-by-default

const PERMISSION_GATE_STORAGE_KEY = "lap.reader.permission.preview";
const SAFE_PERMISSION_GATE_COPY =
  "开发预览 / 只读 / 未连接真实权限 / 生产默认 blocked / 不会写入数据库";

function normalizeNullableString(value) {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeDisplayString(value, maxLength) {
  const normalized = normalizeNullableString(value);
  if (!normalized) { return null; }
  if (typeof maxLength !== "number" || !Number.isFinite(maxLength) || maxLength <= 0) {
    return normalized;
  }
  if (normalized.length <= maxLength) { return normalized; }
  return normalized.slice(0, Math.max(0, maxLength - 3)) + "...";
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBoolean(value) {
  return typeof value === "boolean";
}

function maskServerUserIdPreview(rawValue) {
  if (typeof rawValue !== "string" || rawValue.trim().length === 0) {
    return "未提供（预览掩码）";
  }
  const normalized = rawValue.trim();
  if (normalized.length <= 3) { return "***（预览掩码）"; }
  return normalized.slice(0, 3) + "***（预览掩码）";
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
  var normalized = normalizeSafeKey(rawKey);
  if (!normalized) { return false; }
  for (var i = 0; i < SENSITIVE_FIELD_PATTERNS.length; i += 1) {
    if (normalized === SENSITIVE_FIELD_PATTERNS[i] ||
        (SENSITIVE_FIELD_PATTERNS[i].length > 4 && normalized.indexOf(SENSITIVE_FIELD_PATTERNS[i]) !== -1)) {
      return true;
    }
  }
  return false;
}

function collectSensitiveFieldHits(value, path, hits) {
  var currentPath = Array.isArray(path) ? path : [];
  var currentHits = Array.isArray(hits) ? hits : [];
  if (!isRecord(value) && !Array.isArray(value)) { return currentHits; }
  if (Array.isArray(value)) {
    for (var i = 0; i < value.length; i += 1) {
      collectSensitiveFieldHits(value[i], currentPath.concat(String(i)), currentHits);
    }
    return currentHits;
  }
  var keys = Object.keys(value);
  for (var j = 0; j < keys.length; j += 1) {
    var key = keys[j];
    var nextPath = currentPath.concat(key);
    if (isSensitiveFieldName(key)) { currentHits.push(nextPath.join(".")); }
    collectSensitiveFieldHits(value[key], nextPath, currentHits);
  }
  return currentHits;
}

function normalizePermissionGatePreviewRecord(value) {
  if (!isRecord(value)) { return null; }
  var sensitiveFieldHits = collectSensitiveFieldHits(value);
  var serverUserIdPreview = maskServerUserIdPreview(value.serverUserId);
  var bookId = normalizeDisplayString(value.bookId, 80) || "-";
  var chapterId = normalizeDisplayString(value.chapterId, 80) || "-";
  var canAccessBook = isBoolean(value.canAccessBook) ? String(value.canAccessBook) : "未提供";
  var canAccessChapter = isBoolean(value.canAccessChapter) ? String(value.canAccessChapter) : "未提供";
  var canWriteProgress = isBoolean(value.canWriteProgress) ? String(value.canWriteProgress) : "未提供";
  var explicitUserAuthorization = isBoolean(value.explicitUserAuthorization) ? String(value.explicitUserAuthorization) : "未提供";
  var gateStatusText = normalizeDisplayString(value.gateStatus, 40) || normalizeDisplayString(value.status, 40) || "preview";
  var blockedReasonsText = Array.isArray(value.blockedReasons)
    ? value.blockedReasons.filter(function (r) { return typeof r === "string" && r.trim().length > 0; }).join("; ") || "无"
    : "未提供";
  var hasPreviewViolation = value.previewOnly !== undefined && value.previewOnly !== true;
  return {
    serverUserIdPreview: serverUserIdPreview,
    bookId: bookId,
    chapterId: chapterId,
    canAccessBook: canAccessBook,
    canAccessChapter: canAccessChapter,
    canWriteProgress: canWriteProgress,
    explicitUserAuthorization: explicitUserAuthorization,
    gateStatusText: gateStatusText,
    blockedReasonsText: blockedReasonsText,
    previewOnlyText: "true",
    sensitiveText: sensitiveFieldHits.length > 0 ? "已过滤敏感字段" : "-",
    degradedText: hasPreviewViolation ? "权限门数据结构不完整，已安全降级" : null,
  };
}

function readPermissionGatePreviewFromStorage(storage) {
  if (!storage) {
    return { stateKind: "unavailable", statusText: "本地权限门预览数据不可用", noteText: SAFE_PERMISSION_GATE_COPY, hintText: "当前环境无法读取 localStorage，已安全降级。", filteredText: null, record: null };
  }
  var rawValue = null;
  try { rawValue = storage.getItem(PERMISSION_GATE_STORAGE_KEY); }
  catch (_e) { return { stateKind: "unavailable", statusText: "本地权限门预览数据不可用", noteText: SAFE_PERMISSION_GATE_COPY, hintText: "当前环境无法读取 localStorage，已安全降级。", filteredText: null, record: null }; }
  if (rawValue === null) {
    return { stateKind: "empty", statusText: "暂无本地权限门预览", noteText: SAFE_PERMISSION_GATE_COPY, hintText: "请在 localStorage 中写入 lap.reader.permission.preview 后点击刷新。", filteredText: null, record: null };
  }
  var parsedValue = null;
  try { parsedValue = JSON.parse(rawValue); }
  catch (_e) { return { stateKind: "degraded", statusText: "本地权限门预览已安全降级", noteText: SAFE_PERMISSION_GATE_COPY, hintText: "本地权限门预览 JSON 不可解析，已安全降级。", filteredText: null, record: null }; }
  if (!isRecord(parsedValue)) {
    return { stateKind: "degraded", statusText: "本地权限门预览已安全降级", noteText: SAFE_PERMISSION_GATE_COPY, hintText: "本地权限门预览结构不兼容，已安全降级。", filteredText: null, record: null };
  }
  var sensitiveFieldHits = collectSensitiveFieldHits(parsedValue);
  var filteredText = sensitiveFieldHits.length > 0 ? "已过滤敏感字段" : null;
  var record = normalizePermissionGatePreviewRecord(parsedValue);
  if (!record) {
    return { stateKind: "degraded", statusText: "本地权限门预览已安全降级", noteText: SAFE_PERMISSION_GATE_COPY, hintText: "本地权限门预览记录无法安全展示，已安全降级。", filteredText: filteredText, record: null };
  }
  return { stateKind: "ready", statusText: "已读取本地权限门预览", noteText: SAFE_PERMISSION_GATE_COPY, hintText: "点击刷新可重新读取 localStorage。", filteredText: filteredText, record: record };
}

function buildLocalReaderPermissionGatePreviewPanelScript() {
  return "(function () {\n" +
  "var K=" + JSON.stringify(PERMISSION_GATE_STORAGE_KEY) + ";\n" +
  "var C=" + JSON.stringify(SAFE_PERMISSION_GATE_COPY) + ";\n" +
  "var P=" + JSON.stringify(SENSITIVE_FIELD_PATTERNS) + ";\n" +
  "function isRecord(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}\n" +
  "function isBoolean(v){return typeof v==='boolean';}\n" +
  "function nns(v){if(typeof v!=='string')return null;var n=v.trim();return n.length>0?n:null;}\n" +
  "function nds(v,m){var n=nns(v);if(!n)return null;if(typeof m!=='number'||m<=0)return n;if(n.length<=m)return n;return n.slice(0,m-3)+'...';}\n" +
  "function mask(v){if(typeof v!=='string'||v.trim().length===0)return '未提供（预览掩码）';var n=v.trim();if(n.length<=3)return '***（预览掩码）';return n.slice(0,3)+'***（预览掩码）';}\n" +
  "function nsk(v){return typeof v==='string'?v.trim().toLowerCase().replace(/[^a-z0-9]/g,''):'';}\n" +
  "function iss(v){var n=nsk(v);if(!n)return false;for(var i=0;i<P.length;i++){if(n===P[i]||(P[i].length>4&&n.indexOf(P[i])!==-1))return true;}return false;}\n" +
  "function csh(v,p,h){var cp=Array.isArray(p)?p:[];var ch=Array.isArray(h)?h:[];if(!isRecord(v)&&!Array.isArray(v))return ch;if(Array.isArray(v)){for(var i=0;i<v.length;i++)csh(v[i],cp.concat(String(i)),ch);return ch;}var ks=Object.keys(v);for(var j=0;j<ks.length;j++){var k=ks[j];var np=cp.concat(k);if(iss(k))ch.push(np.join('.'));csh(v[k],np,ch);}return ch;}\n" +
  "function norm(v){if(!isRecord(v))return null;var sh=csh(v);var sp=mask(v.serverUserId);var bi=nds(v.bookId,80)||'-';var ci=nds(v.chapterId,80)||'-';var cab=isBoolean(v.canAccessBook)?String(v.canAccessBook):'未提供';var cac=isBoolean(v.canAccessChapter)?String(v.canAccessChapter):'未提供';var cwp=isBoolean(v.canWriteProgress)?String(v.canWriteProgress):'未提供';var eua=isBoolean(v.explicitUserAuthorization)?String(v.explicitUserAuthorization):'未提供';var gs=nds(v.gateStatus,40)||nds(v.status,40)||'preview';var br=Array.isArray(v.blockedReasons)?v.blockedReasons.filter(function(r){return typeof r==='string'&&r.trim().length>0;}).join('; ')||'无':'未提供';var hp=(v.previewOnly!==undefined&&v.previewOnly!==true);return{serverUserIdPreview:sp,bookId:bi,chapterId:ci,canAccessBook:cab,canAccessChapter:cac,canWriteProgress:cwp,explicitUserAuthorization:eua,gateStatusText:gs,blockedReasonsText:br,previewOnlyText:'true',sensitiveText:sh.length>0?'已过滤敏感字段':'-',degradedText:hp?'权限门数据结构不完整，已安全降级':null};}\n" +
  "function rs(){var s=null;try{s=window.localStorage;if(!s)return{sk:'unavailable',st:'本地权限门预览数据不可用',nt:C,ht:'当前环境无法读取 localStorage，已安全降级。',ft:null,rc:null};}catch(e){return{sk:'unavailable',st:'本地权限门预览数据不可用',nt:C,ht:'当前环境无法读取 localStorage，已安全降级。',ft:null,rc:null};}var rv=null;try{rv=s.getItem(K);}catch(e){return{sk:'unavailable',st:'本地权限门预览数据不可用',nt:C,ht:'当前环境无法读取 localStorage，已安全降级。',ft:null,rc:null};}if(rv===null)return{sk:'empty',st:'暂无本地权限门预览',nt:C,ht:'请在 localStorage 中写入 lap.reader.permission.preview 后点击刷新。',ft:null,rc:null};var pv=null;try{pv=JSON.parse(rv);}catch(e){return{sk:'degraded',st:'本地权限门预览已安全降级',nt:C,ht:'本地权限门预览 JSON 不可解析，已安全降级。',ft:null,rc:null};}if(!isRecord(pv))return{sk:'degraded',st:'本地权限门预览已安全降级',nt:C,ht:'本地权限门预览结构不兼容，已安全降级。',ft:null,rc:null};var sh=csh(pv);var ft=sh.length>0?'已过滤敏感字段':null;var rc=norm(pv);if(!rc)return{sk:'degraded',st:'本地权限门预览已安全降级',nt:C,ht:'本地权限门预览记录无法安全展示，已安全降级。',ft:ft,rc:null};return{sk:'ready',st:'已读取本地权限门预览',nt:C,ht:'点击刷新可重新读取 localStorage。',ft:ft,rc:rc};}\n" +
  "function ee(id,tag,par){var n=document.getElementById(id);if(n)return n;n=document.createElement(tag);n.id=id;if(par)par.appendChild(n);return n;}\n" +
  "var panel=document.getElementById('desktop-reader-permission-gate-preview-panel');\n" +
  "if(!panel){panel=document.createElement('section');panel.id='desktop-reader-permission-gate-preview-panel';panel.setAttribute('aria-live','polite');panel.style.marginTop='12px';panel.style.border='1px solid #d9dee7';panel.style.borderRadius='10px';panel.style.background='#f8fafc';panel.style.padding='12px';panel.style.boxShadow='0 1px 0 rgba(15,23,42,0.03)';var an=document.getElementById('desktop-reader-audit-preview-panel')||document.getElementById('desktop-home-learning-action-card')||document.getElementById('desktop-home-bookmark-preview-card')||document.getElementById('desktop-navigation-shell');if(an&&an.parentNode){if(an.nextSibling)an.parentNode.insertBefore(panel,an.nextSibling);else an.parentNode.appendChild(panel);}else document.body.appendChild(panel);}\n" +
  "var tn=ee('desktop-reader-permission-gate-preview-title','p',panel);tn.style.margin='0';tn.style.fontWeight='600';tn.textContent='Reader 权限门（本地预览）';\n" +
  "var nn=ee('desktop-reader-permission-gate-preview-note','p',panel);nn.style.marginTop='6px';nn.style.color='#5b6473';nn.style.fontSize='13px';nn.textContent=C;\n" +
  "var sn=ee('desktop-reader-permission-gate-preview-status','p',panel);sn.style.marginTop='6px';sn.style.fontWeight='600';\n" +
  "var hn=ee('desktop-reader-permission-gate-preview-hint','p',panel);hn.style.marginTop='6px';hn.style.color='#5b6473';hn.style.fontSize='13px';\n" +
  "var fn=ee('desktop-reader-permission-gate-preview-filtered','p',panel);fn.style.marginTop='6px';fn.style.color='#5b6473';fn.style.fontSize='13px';fn.style.fontWeight='600';\n" +
  "var bn=ee('desktop-reader-permission-gate-preview-refresh-button','button',panel);bn.type='button';bn.textContent='刷新本地权限预览';bn.style.display='inline-flex';bn.style.alignItems='center';bn.style.justifyContent='center';bn.style.border='1px solid #d9dee7';bn.style.borderRadius='8px';bn.style.background='#ffffff';bn.style.color='#1f2937';bn.style.fontWeight='600';bn.style.fontSize='14px';bn.style.minHeight='38px';bn.style.padding='0 14px';bn.style.cursor='pointer';bn.style.marginTop='10px';\n" +
  "var dn=ee('desktop-reader-permission-gate-preview-details','ul',panel);dn.style.marginTop='12px';dn.style.listStyle='none';dn.style.paddingLeft='0';dn.style.display='grid';dn.style.gap='8px';\n" +
  "function buildRow(l,v){var li=document.createElement('li');li.style.display='grid';li.style.gridTemplateColumns='180px 1fr';li.style.gap='8px';li.style.fontSize='14px';var ls=document.createElement('span');ls.style.color='#5b6473';ls.textContent=l;var vs=document.createElement('strong');vs.textContent=String(v);li.appendChild(ls);li.appendChild(vs);return li;}\n" +
  "function render(){var s=rs();sn.textContent=s.st;hn.textContent=s.ht;fn.textContent=s.ft||'';dn.innerHTML='';if(!s.rc){var el=document.createElement('li');el.style.color='#5b6473';el.textContent='暂无权限门数据';dn.appendChild(el);return s;}var r=s.rc;var rows=[['用户标识（掩码）',r.serverUserIdPreview],['bookId',r.bookId],['chapterId',r.chapterId],['canAccessBook',r.canAccessBook],['canAccessChapter',r.canAccessChapter],['canWriteProgress',r.canWriteProgress],['explicitUserAuthorization',r.explicitUserAuthorization],['gateStatus',r.gateStatusText],['blockedReasons',r.blockedReasonsText],['previewOnly',r.previewOnlyText],['敏感字段',r.sensitiveText]];if(r.degradedText)rows.push(['降级',r.degradedText]);for(var i=0;i<rows.length;i++)dn.appendChild(buildRow(rows[i][0],rows[i][1]));return s;}\n" +
  "bn.onclick=function(){render();};\n" +
  "render();\n" +
  "return true;\n" +
  "})();";
}

module.exports = {
  PERMISSION_GATE_STORAGE_KEY,
  SAFE_PERMISSION_GATE_COPY,
  maskServerUserIdPreview,
  collectSensitiveFieldHits,
  normalizePermissionGatePreviewRecord,
  readPermissionGatePreviewFromStorage,
  buildLocalReaderPermissionGatePreviewPanelScript,
};
