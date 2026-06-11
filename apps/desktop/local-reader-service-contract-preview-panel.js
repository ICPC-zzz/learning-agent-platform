// Desktop 本地预览面板：Reader Sync Service Contract
//
// 职责:
//   - 只读 localStorage（lap.reader.serviceContract.preview）。
//   - 展示 mock service contract readiness 安全摘要字段。
//   - 复用 local-preview-safe-storage.js 过滤危险字段。
//   - 空态/JSON 损坏/字段类型错误/安全阻断安全降级。
//   - 只读刷新按钮，不写 localStorage，不调网络，不接真实 service/repository/DB。
//
// Status: preview-only / local-only / read-only / disabled-by-default

var SERVICE_CONTRACT_STORAGE_KEY = "lap.reader.serviceContract.preview";
var SAFE_SERVICE_CONTRACT_COPY =
  "开发预览 / 只读 / 真实 service 未连接 / 真实 repository 未调用 / 生产默认 blocked / 不会写入数据库 / 不会调用 repository";

function isEmptyString(val) {
  if (typeof val !== "string") { return null; }
  var n = val.trim();
  return n.length > 0 ? n : null;
}

function trimDisplay(value, max) {
  var n = isEmptyString(value);
  if (!n) { return null; }
  if (typeof max !== "number" || !Number.isFinite(max) || max <= 0) { return n; }
  if (n.length <= max) { return n; }
  return n.slice(0, Math.max(0, max - 3)) + "...";
}

function isObj(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isBool(value) {
  return typeof value === "boolean";
}

function resolveStatusLabel(s) {
  if (typeof s !== "string") { return "未知"; }
  var n = s.trim().toLowerCase();
  if (n === "blocked") { return "已阻断"; }
  if (n === "ready_preview") { return "预览就绪（本地预览）"; }
  if (n === "preview") { return "预览"; }
  return s;
}

function normalizeServiceContractRecord(value, filterFn) {
  if (!isObj(value)) { return null; }

  var ft = null;
  var rec = value;

  if (filterFn && typeof filterFn === "object" && typeof filterFn.collectHits === "function") {
    var hits = filterFn.collectHits(value);
    if (hits.length > 0) {
      ft = "已过滤敏感字段";
      if (typeof filterFn.sanitize === "function") { rec = filterFn.sanitize(value); }
    }
  }

  // safeToExposeToClient=false: fully blocked
  if (rec.safeToExposeToClient === false) {
    return {
      sk: "blocked",
      bs: "safeToExposeToClient=false，面板已安全阻断，不展示任何细节字段。",
      ft: ft,
    };
  }

  // Safe boolean flags
  var ar = isBool(rec.authReady) ? rec.authReady : null;
  var st = isBool(rec.serverTrusted) ? rec.serverTrusted : null;
  var pg = isBool(rec.permissionGateReady) ? rec.permissionGateReady : null;
  var ik = isBool(rec.idempotencyKeyReady) ? rec.idempotencyKeyReady : null;
  var ic = isBool(rec.idempotencyConflictClear) ? rec.idempotencyConflictClear : null;
  var au = isBool(rec.auditReady) ? rec.auditReady : null;
  var wp = isBool(rec.writePreflightReady) ? rec.writePreflightReady : null;
  var rw = isBool(rec.repositoryWriteAllowed) ? rec.repositoryWriteAllowed : null;
  var pw = isBool(rec.productionWriteReady) ? rec.productionWriteReady : null;
  var im = isBool(rec.implemented) ? rec.implemented : null;
  var po = isBool(rec.previewOnly) ? rec.previewOnly : null;
  var wd = isBool(rec.writesDatabase) ? rec.writesDatabase : null;
  var cr = isBool(rec.callsRepository) ? rec.callsRepository : null;
  var sc = isBool(rec.safeToExposeToClient) ? rec.safeToExposeToClient : null;

  // status
  var rawStatus = isEmptyString(rec.status);
  var statusText = rawStatus ? resolveStatusLabel(rawStatus) : "-";

  // blockedReasons
  var brText = "-";
  if (rec.blockedReasons !== undefined && rec.blockedReasons !== null) {
    if (Array.isArray(rec.blockedReasons)) {
      var validReasons = rec.blockedReasons.filter(function (r) { return typeof r === "string" && r.trim().length > 0; }).slice(0, 5);
      brText = validReasons.length > 0 ? validReasons.join(" | ") : "（空数组）";
      if (rec.blockedReasons.length > 5) { brText += " …（截断）"; }
    } else {
      brText = "（类型错误）";
    }
  }

  // summary
  var summaryText = trimDisplay(rec.summary, 200) || "-";

  // warnings
  var warningsText = "-";
  if (Array.isArray(rec.warnings)) {
    var validWarnings = rec.warnings.filter(function (r) { return typeof r === "string" && r.trim().length > 0; }).slice(0, 5);
    warningsText = validWarnings.length > 0 ? validWarnings.join(" | ") : "（空数组）";
    if (rec.warnings.length > 5) { warningsText += " …（截断）"; }
  }

  // Safety warnings
  var safetyWarnings = [];
  if (rw === true) {
    safetyWarnings.push("安全警告：repositoryWriteAllowed=true，仅本地 mock 字段，不代表真实 service/repository 已启用。");
  }
  if (pw === true) {
    safetyWarnings.push("安全警告：productionWriteReady=true，仅本地 mock 字段，不代表生产写入已启用。");
  }
  if (im === true) {
    safetyWarnings.push("安全警告：implemented=true，但真实 service 未连接、repository 未调用、DB 未启用。");
  }
  if (wd === true) {
    safetyWarnings.push("安全警告：writesDatabase=true，但真实写入仍未启用。");
  }
  if (cr === true) {
    safetyWarnings.push("安全警告：callsRepository=true，但真实 repository 未被调用。");
  }
  if (po !== null && po !== true) {
    safetyWarnings.push("previewOnly 字段异常，已安全降级");
  }

  var rwaText = rw === true ? "true（仅本地 mock 字段，不代表真实 service/repository 已启用）" : (rw === false ? "false" : "未提供");
  var pwrText = pw === true ? "true（仅本地 mock 字段，不代表生产写入已启用）" : (pw === false ? "false" : "未提供");
  var imText = im === true ? "true（安全警告：真实 service 未连接）" : (im === false ? "false" : "未提供");

  return {
    sk: safetyWarnings.length > 0 ? "degraded" : "ready",
    // Safe fields
    authReadyText: ar === true ? "true" : (ar === false ? "false" : "未提供"),
    authReadyBool: ar,
    serverTrustedText: st === true ? "true" : (st === false ? "false" : "未提供"),
    serverTrustedBool: st,
    permissionGateReadyText: pg === true ? "true" : (pg === false ? "false" : "未提供"),
    idempotencyKeyReadyText: ik === true ? "true" : (ik === false ? "false" : "未提供"),
    idempotencyConflictClearText: ic === true ? "true" : (ic === false ? "false" : "未提供"),
    auditReadyText: au === true ? "true" : (au === false ? "false" : "未提供"),
    writePreflightReadyText: wp === true ? "true" : (wp === false ? "false" : "未提供"),
    repositoryWriteAllowedText: rwaText,
    productionWriteReadyText: pwrText,
    implementedText: imText,
    previewOnlyText: po === true ? "true" : (po === false ? "false" : "未提供"),
    writesDatabaseText: wd === true ? "true（安全警告：真实写入未启用）" : (wd === false ? "false" : "未提供"),
    callsRepositoryText: cr === true ? "true（安全警告：真实 repository 未调用）" : (cr === false ? "false" : "未提供"),
    safeToExposeToClientText: sc === true ? "true" : (sc === false ? "false（已阻断）" : "未提供"),
    statusText: statusText,
    blockedReasonsText: brText,
    summaryText: summaryText,
    warningsText: warningsText,
    // Safety
    hasSafetyWarnings: safetyWarnings.length > 0,
    safetyWarningsText: safetyWarnings.length > 0 ? safetyWarnings.join("；") : null,
    // Filter
    filteredText: ft,
  };
}

function buildEmptySnap() {
  return {
    sk: "empty",
    st: "暂无本地 Service Contract 预览",
    nt: SAFE_SERVICE_CONTRACT_COPY,
    ht: "请在 localStorage 中写入 lap.reader.serviceContract.preview 后点击刷新。",
    ft: null,
    rc: null,
  };
}

function buildUnavailSnap() {
  return {
    sk: "unavailable",
    st: "本地 Service Contract 预览不可用",
    nt: SAFE_SERVICE_CONTRACT_COPY,
    ht: "当前环境无法读取 localStorage，已安全降级。",
    ft: null,
    rc: null,
  };
}

function buildDegSnap(ht, ft) {
  return {
    sk: "degraded",
    st: "本地 Service Contract 预览已安全降级",
    nt: SAFE_SERVICE_CONTRACT_COPY,
    ht: trimDisplay(ht, 140) || "本地 Service Contract 预览结构不兼容，已安全降级。",
    ft: ft || null,
    rc: null,
  };
}

function buildReadySnap(rec) {
  return {
    sk: rec.hasSafetyWarnings ? "degraded" : "ready",
    st: rec.hasSafetyWarnings ? "已读取本地 Service Contract 预览，存在安全警告" : "已读取本地 Service Contract 预览",
    nt: SAFE_SERVICE_CONTRACT_COPY,
    ht: "点击刷新可重新读取 localStorage。",
    ft: rec.filteredText,
    rc: rec,
  };
}

function readServiceContractPreview(storage) {
  if (!storage || typeof storage.getItem !== "function") { return buildUnavailSnap(); }
  var rv = null;
  try { rv = storage.getItem(SERVICE_CONTRACT_STORAGE_KEY); }
  catch (_e) { return buildUnavailSnap(); }
  if (rv === null || rv === undefined) { return buildEmptySnap(); }
  var pv = null;
  try { pv = JSON.parse(rv); }
  catch (_e) { return buildDegSnap("本地 Service Contract 预览 JSON 不可解析，已安全降级。", null); }
  if (!isObj(pv)) { return buildDegSnap("本地 Service Contract 预览结构不兼容（值不是对象），已安全降级。", null); }

  var sm = null;
  try { sm = require("./local-preview-safe-storage.js"); } catch (_e) { sm = null; }
  var ff = null;
  if (sm) { ff = { collectHits: sm.collectSensitiveFieldHits, sanitize: sm.sanitizeSensitiveFields }; }

  var rec = normalizeServiceContractRecord(pv, ff);
  if (!rec) { return buildDegSnap("本地 Service Contract 预览记录无法安全展示，已安全降级。", null); }
  if (rec.sk === "blocked") {
    return { sk: "degraded", st: "本地 Service Contract 预览已安全阻断", nt: SAFE_SERVICE_CONTRACT_COPY, ht: rec.bs, ft: rec.ft, rc: null };
  }
  return buildReadySnap(rec);
}

function buildPanelScript() {
  return "(()=>{var K=" + JSON.stringify(SERVICE_CONTRACT_STORAGE_KEY) + ";var C=" + JSON.stringify(SAFE_SERVICE_CONTRACT_COPY) + ";" +
    "function isObj(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}" +
    "function isBool(v){return typeof v==='boolean';}" +
    "function ns(v){if(typeof v!=='string')return null;var n=v.trim();return n.length>0?n:null;}" +
    "function nd(v,m){var n=ns(v);if(!n)return null;if(typeof m!=='number'||m<=0)return n;if(n.length<=m)return n;return n.slice(0,m-3)+'...';}" +
    "function rsl(s){if(typeof s!=='string')return'未知';var n=s.trim().toLowerCase();if(n==='blocked')return'已阻断';if(n==='ready_preview')return'预览就绪（本地预览）';if(n==='preview')return'预览';return s;}" +
    "function nr(v){if(!isObj(v))return null;var ft=null;var rec=v;if(window.__lapSafeStorage&&typeof window.__lapSafeStorage.collectSensitiveFieldHits==='function'){var hits=window.__lapSafeStorage.collectSensitiveFieldHits(v);if(hits.length>0){ft='已过滤敏感字段';rec=window.__lapSafeStorage.sanitizeSensitiveFields(v);}}" +
    "if(rec.safeToExposeToClient===false){return{sk:'blocked',bs:'safeToExposeToClient=false，面板已安全阻断，不展示任何细节字段。',ft:ft};}" +
    "var ar=isBool(rec.authReady)?rec.authReady:null;var st=isBool(rec.serverTrusted)?rec.serverTrusted:null;var pg=isBool(rec.permissionGateReady)?rec.permissionGateReady:null;var ik=isBool(rec.idempotencyKeyReady)?rec.idempotencyKeyReady:null;var ic=isBool(rec.idempotencyConflictClear)?rec.idempotencyConflictClear:null;var au=isBool(rec.auditReady)?rec.auditReady:null;var wp=isBool(rec.writePreflightReady)?rec.writePreflightReady:null;var rw=isBool(rec.repositoryWriteAllowed)?rec.repositoryWriteAllowed:null;var pw=isBool(rec.productionWriteReady)?rec.productionWriteReady:null;var im=isBool(rec.implemented)?rec.implemented:null;var po=isBool(rec.previewOnly)?rec.previewOnly:null;var wd=isBool(rec.writesDatabase)?rec.writesDatabase:null;var cr=isBool(rec.callsRepository)?rec.callsRepository:null;var sc=isBool(rec.safeToExposeToClient)?rec.safeToExposeToClient:null;" +
    "var rs=ns(rec.status);var stx=rs?rsl(rs):'-';" +
    "var brt='-';if(rec.blockedReasons!==undefined&&rec.blockedReasons!==null){if(Array.isArray(rec.blockedReasons)){var vr=rec.blockedReasons.filter(function(r){return typeof r==='string'&&r.trim().length>0;}).slice(0,5);brt=vr.length>0?vr.join(' | '):'（空数组）';if(rec.blockedReasons.length>5)brt+=' …（截断）';}else{brt='（类型错误）';}}" +
    "var sut=nd(rec.summary,200)||'-';" +
    "var wt='-';if(Array.isArray(rec.warnings)){var vw=rec.warnings.filter(function(r){return typeof r==='string'&&r.trim().length>0;}).slice(0,5);wt=vw.length>0?vw.join(' | '):'（空数组）';if(rec.warnings.length>5)wt+=' …（截断）';}" +
    "var sw=[];if(rw===true)sw.push('安全警告：repositoryWriteAllowed=true，仅本地 mock 字段，不代表真实 service/repository 已启用。');if(pw===true)sw.push('安全警告：productionWriteReady=true，仅本地 mock 字段，不代表生产写入已启用。');if(im===true)sw.push('安全警告：implemented=true，但真实 service 未连接、repository 未调用、DB 未启用。');if(wd===true)sw.push('安全警告：writesDatabase=true，但真实写入仍未启用。');if(cr===true)sw.push('安全警告：callsRepository=true，但真实 repository 未被调用。');if(po!==null&&po!==true)sw.push('previewOnly 字段异常，已安全降级');" +
    "var rwt=rw===true?'true（仅本地 mock 字段，不代表真实 service/repository 已启用）':(rw===false?'false':'未提供');var pwt=pw===true?'true（仅本地 mock 字段，不代表生产写入已启用）':(pw===false?'false':'未提供');var imt=im===true?'true（安全警告：真实 service 未连接）':(im===false?'false':'未提供');" +
    "return{sk:sw.length>0?'degraded':'ready',art:ar===true?'true':(ar===false?'false':'未提供'),stt:st===true?'true':(st===false?'false':'未提供'),pgt:pg===true?'true':(pg===false?'false':'未提供'),ikt:ik===true?'true':(ik===false?'false':'未提供'),ict:ic===true?'true':(ic===false?'false':'未提供'),aut:au===true?'true':(au===false?'false':'未提供'),wpt:wp===true?'true':(wp===false?'false':'未提供'),rwt:rwt,pwt:pwt,imt:imt,pot:po===true?'true':(po===false?'false':'未提供'),wdt:wd===true?'true（安全警告：真实写入未启用）':(wd===false?'false':'未提供'),crt:cr===true?'true（安全警告：真实 repository 未调用）':(cr===false?'false':'未提供'),sct:sc===true?'true':(sc===false?'false（已阻断）':'未提供'),stx:stx,brt:brt,sut:sut,wt:wt,ft:ft,hd:sw.length>0,swt:sw.length>0?sw.join('；'):null};}" +
    "function rs(){var s=null;try{s=window.localStorage;if(!s)return buildUnavail();}catch(e){return buildUnavail();}var rv=null;try{rv=s.getItem(K);}catch(e){return buildUnavail();}if(rv===null||rv===undefined)return buildEmpty();var pv=null;try{pv=JSON.parse(rv);}catch(e){return buildDeg('本地 Service Contract 预览 JSON 不可解析，已安全降级。',null);}if(!isObj(pv))return buildDeg('本地 Service Contract 预览结构不兼容（值不是对象），已安全降级。',null);var rec=nr(pv);if(!rec)return buildDeg('本地 Service Contract 预览记录无法安全展示，已安全降级。',null);if(rec.sk==='blocked')return{sk:'degraded',st:'本地 Service Contract 预览已安全阻断',nt:C,ht:rec.bs,ft:rec.ft,rc:null};return{sk:rec.hd?'degraded':'ready',st:rec.hd?'已读取本地 Service Contract 预览，存在安全警告':'已读取本地 Service Contract 预览',nt:C,ht:'点击刷新可重新读取 localStorage。',ft:rec.ft,rc:rec};}" +
    "function buildEmpty(){return{sk:'empty',st:'暂无本地 Service Contract 预览',nt:C,ht:'请在 localStorage 中写入 lap.reader.serviceContract.preview 后点击刷新。',ft:null,rc:null};}" +
    "function buildUnavail(){return{sk:'unavailable',st:'本地 Service Contract 预览不可用',nt:C,ht:'当前环境无法读取 localStorage，已安全降级。',ft:null,rc:null};}" +
    "function buildDeg(ht,ft){return{sk:'degraded',st:'本地 Service Contract 预览已安全降级',nt:C,ht:nd(ht,140)||'本地 Service Contract 预览结构不兼容，已安全降级。',ft:ft||null,rc:null};}" +
    "function ee(id,tag,par){var n=document.getElementById(id);if(n)return n;n=document.createElement(tag);n.id=id;if(par)par.appendChild(n);return n;}" +
    "function ia(t,n){if(!t||!t.parentNode)return false;var p=t.parentNode;if(t.nextSibling)p.insertBefore(n,t.nextSibling);else p.appendChild(n);return true;}" +
    "var panel=document.getElementById('desktop-reader-service-contract-preview-panel');" +
    "if(!panel){panel=document.createElement('section');panel.id='desktop-reader-service-contract-preview-panel';panel.setAttribute('aria-live','polite');panel.style.marginTop='12px';panel.style.border='1px solid #d9dee7';panel.style.borderRadius='10px';panel.style.background='#f8fafc';panel.style.padding='12px';panel.style.boxShadow='0 1px 0 rgba(15,23,42,0.03)';" +
    "var an=document.getElementById('desktop-reader-auth-session-preview-panel')||document.getElementById('desktop-reader-idempotency-preview-panel')||document.getElementById('desktop-reader-write-preflight-preview-panel')||document.getElementById('desktop-reader-permission-gate-preview-panel')||document.getElementById('desktop-reader-audit-preview-panel')||document.getElementById('desktop-reader-sync-readiness-gate-panel')||document.getElementById('desktop-reader-sync-health-panel')||document.getElementById('desktop-navigation-shell');" +
    "if(!ia(an,panel))document.body.appendChild(panel);}" +
    "var tn=ee('desktop-reader-service-contract-preview-title','p',panel);tn.style.margin='0';tn.style.fontWeight='600';tn.textContent='Reader Sync Service Contract（本地预览）';" +
    "var nn=ee('desktop-reader-service-contract-preview-note','p',panel);nn.style.marginTop='6px';nn.style.color='#5b6473';nn.style.fontSize='13px';nn.textContent=C;" +
    "var sn=ee('desktop-reader-service-contract-preview-status','p',panel);sn.style.marginTop='6px';sn.style.fontWeight='600';" +
    "var hn=ee('desktop-reader-service-contract-preview-hint','p',panel);hn.style.marginTop='6px';hn.style.color='#5b6473';hn.style.fontSize='13px';" +
    "var fn=ee('desktop-reader-service-contract-preview-filtered','p',panel);fn.style.marginTop='6px';fn.style.color='#5b6473';fn.style.fontSize='13px';fn.style.fontWeight='600';" +
    "var wn=ee('desktop-reader-service-contract-preview-warning','p',panel);wn.style.marginTop='10px';wn.style.background='#fff8e1';wn.style.border='1px solid #f3d06b';wn.style.color='#7a5600';wn.style.borderRadius='8px';wn.style.padding='10px 12px';wn.style.fontSize='13px';wn.style.display='none';" +
    "var bn=ee('desktop-reader-service-contract-preview-refresh-button','button',panel);bn.type='button';bn.textContent='刷新本地 Service Contract 预览';bn.style.display='inline-flex';bn.style.alignItems='center';bn.style.justifyContent='center';bn.style.border='1px solid #d9dee7';bn.style.borderRadius='8px';bn.style.background='#ffffff';bn.style.color='#1f2937';bn.style.fontWeight='600';bn.style.fontSize='14px';bn.style.minHeight='38px';bn.style.padding='0 14px';bn.style.cursor='pointer';bn.style.marginTop='10px';" +
    "var dn=ee('desktop-reader-service-contract-preview-details','ul',panel);dn.style.marginTop='12px';dn.style.listStyle='none';dn.style.paddingLeft='0';dn.style.display='grid';dn.style.gap='8px';" +
    "function br(l,v){var li=document.createElement('li');li.style.display='grid';li.style.gridTemplateColumns='220px 1fr';li.style.gap='8px';li.style.fontSize='14px';var ls=document.createElement('span');ls.style.color='#5b6473';ls.textContent=l;var vs=document.createElement('strong');vs.textContent=String(v);li.appendChild(ls);li.appendChild(vs);return li;}" +
    "function render(){var s=rs();sn.textContent=s.st;hn.textContent=s.ht;fn.textContent=s.ft||'';dn.innerHTML='';wn.style.display='none';wn.textContent='';" +
    "if(!s.rc){var ei=document.createElement('li');ei.style.color='#5b6473';ei.textContent='暂无 Service Contract 数据';dn.appendChild(ei);return s;}" +
    "var r=s.rc;var rows=[['authReady',r.art],['serverTrusted',r.stt],['permissionGateReady',r.pgt],['idempotencyKeyReady',r.ikt],['idempotencyConflictClear',r.ict],['auditReady',r.aut],['writePreflightReady',r.wpt],['repositoryWriteAllowed',r.rwt],['productionWriteReady',r.pwt],['implemented',r.imt],['previewOnly',r.pot],['writesDatabase',r.wdt],['callsRepository',r.crt],['safeToExposeToClient',r.sct],['status',r.stx],['blockedReasons',r.brt],['summary',r.sut],['warnings',r.wt]];" +
    "if(r.ft)rows.push(['敏感字段',r.ft]);for(var i=0;i<rows.length;i++)dn.appendChild(br(rows[i][0],rows[i][1]));" +
    "if(r.swt){wn.textContent=r.swt;wn.style.display='block';}return s;}" +
    "bn.onclick=function(){render();};render();return true;})();";
}

module.exports = {
  SERVICE_CONTRACT_STORAGE_KEY,
  SAFE_SERVICE_CONTRACT_COPY,
  resolveStatusLabel,
  normalizeServiceContractRecord,
  readServiceContractPreviewFromStorage: readServiceContractPreview,
  buildLocalReaderServiceContractPreviewPanelScript: buildPanelScript,
};
