// Desktop 本地预览面板：Reader Auth Session
//
// 职责:
//   - 只读 localStorage（lap.reader.authSession.preview）。
//   - 展示 mock auth/session readiness 安全摘要字段。
//   - 复用 local-preview-safe-storage.js 过滤危险字段。
//   - 空态/JSON 损坏/字段类型错误安全降级。
//   - 只读刷新按钮，不写 localStorage，不调网络，不接真实 auth/session。
//
// Status: preview-only / local-only / read-only / disabled-by-default

var AUTH_SESSION_STORAGE_KEY = "lap.reader.authSession.preview";
var SAFE_AUTH_SESSION_COPY =
  "开发预览 / 只读 / 真实 auth 未连接 / 真实 session 未注入 / 生产默认 blocked / 不会写入数据库 / 不会调用 repository";

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

function maskUserId(raw) {
  if (typeof raw !== "string" || raw.trim().length === 0) { return "未提供（预览掩码）"; }
  var n = raw.trim();
  if (n.length <= 3) { return "***（预览掩码）"; }
  return n.slice(0, 3) + "***（预览掩码）";
}

function srcLabel(s) {
  if (typeof s !== "string") { return "未知来源"; }
  var n = s.trim().toLowerCase();
  if (n === "blocked-by-default") { return "默认阻断（blocked-by-default）"; }
  if (n === "trusted-server-context") { return "可信服务端上下文（仅本地预览）"; }
  if (n === "local-mock") { return "本地 mock"; }
  if (n === "preview") { return "预览"; }
  return s;
}

function sessLabel(s) {
  if (typeof s !== "string") { return "未知"; }
  var n = s.trim().toLowerCase();
  if (n === "blocked") { return "已阻断"; }
  if (n === "preview") { return "预览"; }
  if (n === "ready") { return "就绪（仅本地预览）"; }
  if (n === "unavailable") { return "不可用"; }
  return s;
}

function normRecord(value, filterFn) {
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

  if (rec.safeToExposeToClient === false) {
    return { sk: "blocked", stc: "false（已阻断，不展示细节）", bs: "safeToExposeToClient=false，面板已安全阻断，不展示任何细节字段。", ft: ft };
  }

  var auth = isBool(rec.authenticated) ? rec.authenticated : null;
  var ar = isBool(rec.authReady) ? rec.authReady : null;
  var st = isBool(rec.serverTrusted) ? rec.serverTrusted : null;

  var uid = maskUserId(rec.serverUserIdPreview);

  var srcRaw = isEmptyString(rec.authSource) || isEmptyString(rec.source);
  var srcTxt = srcRaw ? srcLabel(srcRaw) : "-";

  var sessRaw = isEmptyString(rec.sessionStatus) || isEmptyString(rec.status);
  var sessTxt = sessRaw ? sessLabel(sessRaw) : "-";

  var brTxt = "-";
  if (rec.blockedReasons !== undefined && rec.blockedReasons !== null) {
    if (Array.isArray(rec.blockedReasons)) {
      var vr = rec.blockedReasons.filter(function(r) { return typeof r === "string" && r.trim().length > 0; }).slice(0, 5);
      brTxt = vr.length > 0 ? vr.join(" | ") : "（空数组）";
      if (rec.blockedReasons.length > 5) { brTxt += " …（截断）"; }
    } else { brTxt = "（类型错误）"; }
  }

  var po = rec.previewOnly === true;

  var stcVal = isBool(rec.safeToExposeToClient) ? rec.safeToExposeToClient : null;
  var stcTxt = stcVal === true ? "true" : (stcVal === false ? "false（已阻断）" : "未提供");

  var warns = [];
  if (auth === true && st === false) { warns.push("安全警告：authenticated=true 但 serverTrusted=false，该 mock 数据不代表真实服务端信任。"); }
  if (auth === true) { warns.push("仅本地 mock 字段，不代表真实登录已接入。"); }
  if (!po) { warns.push("previewOnly 字段异常，已安全降级"); }
  if (rec.writesDatabase === true) { warns.push("本地 mock 字段异常（writesDatabase=true），真实写入仍未启用"); }
  if (rec.callsRepository === true) { warns.push("本地 mock 字段异常（callsRepository=true），真实 repository 未被调用"); }

  return {
    sk: "ready",
    at: auth === true ? "true（仅本地 mock）" : (auth === false ? "false" : "未提供"),
    art: ar === true ? "true" : (ar === false ? "false" : "未提供"),
    stt: st === true ? "true" : (st === false ? "false" : "未提供"),
    uid: uid,
    stx: srcTxt,
    sst: sessTxt,
    brt: brTxt,
    pot: po ? "true" : "false",
    sct: stcTxt,
    ft: ft,
    swt: warns.length > 0 ? warns.join("；") : null,
    hd: warns.length > 0,
  };
}

function buildEmptySnap() {
  return { sk: "empty", st: "暂无本地 Auth Session 预览", nt: SAFE_AUTH_SESSION_COPY, ht: "请在 localStorage 中写入 lap.reader.authSession.preview 后点击刷新。", ft: null, rc: null };
}

function buildUnavailSnap() {
  return { sk: "unavailable", st: "本地 Auth Session 预览不可用", nt: SAFE_AUTH_SESSION_COPY, ht: "当前环境无法读取 localStorage，已安全降级。", ft: null, rc: null };
}

function buildDegSnap(ht, ft) {
  return { sk: "degraded", st: "本地 Auth Session 预览已安全降级", nt: SAFE_AUTH_SESSION_COPY, ht: trimDisplay(ht, 140) || "本地 Auth Session 预览结构不兼容，已安全降级。", ft: ft || null, rc: null };
}

function buildReadySnap(rec) {
  return { sk: rec.hd ? "degraded" : "ready", st: rec.hd ? "已读取本地 Auth Session 预览，存在安全警告" : "已读取本地 Auth Session 预览", nt: SAFE_AUTH_SESSION_COPY, ht: "点击刷新可重新读取 localStorage。", ft: rec.ft, rc: rec };
}

function readAuthSessionPreview(storage) {
  if (!storage || typeof storage.getItem !== "function") { return buildUnavailSnap(); }
  var rv = null;
  try { rv = storage.getItem(AUTH_SESSION_STORAGE_KEY); }
  catch (_e) { return buildUnavailSnap(); }
  if (rv === null || rv === undefined) { return buildEmptySnap(); }
  var pv = null;
  try { pv = JSON.parse(rv); }
  catch (_e) { return buildDegSnap("本地 Auth Session 预览 JSON 不可解析，已安全降级。", null); }
  if (!isObj(pv)) { return buildDegSnap("本地 Auth Session 预览结构不兼容（值不是对象），已安全降级。", null); }

  var sm = null;
  try { sm = require("./local-preview-safe-storage.js"); } catch (_e) { sm = null; }
  var ff = null;
  if (sm) { ff = { collectHits: sm.collectSensitiveFieldHits, sanitize: sm.sanitizeSensitiveFields }; }

  var rec = normRecord(pv, ff);
  if (!rec) { return buildDegSnap("本地 Auth Session 预览记录无法安全展示，已安全降级。", null); }
  if (rec.sk === "blocked") {
    return { sk: "degraded", st: "本地 Auth Session 预览已安全阻断", nt: SAFE_AUTH_SESSION_COPY, ht: rec.bs, ft: rec.ft, rc: null };
  }
  return buildReadySnap(rec);
}

function buildPanelScript() {
  return "(()=>{var K=" + JSON.stringify(AUTH_SESSION_STORAGE_KEY) + ";var C=" + JSON.stringify(SAFE_AUTH_SESSION_COPY) + ";" +
    "function isObj(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}" +
    "function isBool(v){return typeof v==='boolean';}" +
    "function ns(v){if(typeof v!=='string')return null;var n=v.trim();return n.length>0?n:null;}" +
    "function nd(v,m){var n=ns(v);if(!n)return null;if(typeof m!=='number'||m<=0)return n;if(n.length<=m)return n;return n.slice(0,m-3)+'...';}" +
    "function mu(v){if(typeof v!=='string'||v.trim().length===0)return '未提供（预览掩码）';var n=v.trim();if(n.length<=3)return '***（预览掩码）';return n.slice(0,3)+'***（预览掩码）';}" +
    "function sl(s){if(typeof s!=='string')return '未知来源';var n=s.trim().toLowerCase();if(n==='blocked-by-default')return '默认阻断（blocked-by-default）';if(n==='trusted-server-context')return '可信服务端上下文（仅本地预览）';if(n==='local-mock')return '本地 mock';if(n==='preview')return '预览';return s;}" +
    "function ssl(s){if(typeof s!=='string')return '未知';var n=s.trim().toLowerCase();if(n==='blocked')return '已阻断';if(n==='preview')return '预览';if(n==='ready')return '就绪（仅本地预览）';if(n==='unavailable')return '不可用';return s;}" +
    "function nr(v){if(!isObj(v))return null;var ft=null;var rec=v;if(window.__lapSafeStorage&&typeof window.__lapSafeStorage.collectSensitiveFieldHits==='function'){var hits=window.__lapSafeStorage.collectSensitiveFieldHits(v);if(hits.length>0){ft='已过滤敏感字段';rec=window.__lapSafeStorage.sanitizeSensitiveFields(v);}}" +
    "if(rec.safeToExposeToClient===false){return{sk:'blocked',bs:'safeToExposeToClient=false，面板已安全阻断，不展示任何细节字段。',ft:ft};}" +
    "var auth=isBool(rec.authenticated)?rec.authenticated:null;var ar=isBool(rec.authReady)?rec.authReady:null;var stt=isBool(rec.serverTrusted)?rec.serverTrusted:null;" +
    "var uid=mu(rec.serverUserIdPreview);" +
    "var srr=ns(rec.authSource)||ns(rec.source);var stx=srr?sl(srr):'-';" +
    "var ssr=ns(rec.sessionStatus)||ns(rec.status);var sst=ssr?ssl(ssr):'-';" +
    "var brt='-';if(rec.blockedReasons!==undefined&&rec.blockedReasons!==null){if(Array.isArray(rec.blockedReasons)){var vr=rec.blockedReasons.filter(function(r){return typeof r==='string'&&r.trim().length>0;}).slice(0,5);brt=vr.length>0?vr.join(' | '):'（空数组）';if(rec.blockedReasons.length>5)brt+=' …（截断）';}else{brt='（类型错误）';}}" +
    "var po=rec.previewOnly===true;" +
    "var scv=isBool(rec.safeToExposeToClient)?rec.safeToExposeToClient:null;var sct=scv===true?'true':(scv===false?'false（已阻断）':'未提供');" +
    "var w=[];if(auth===true&&stt===false)w.push('安全警告：authenticated=true 但 serverTrusted=false，该 mock 数据不代表真实服务端信任。');if(auth===true)w.push('仅本地 mock 字段，不代表真实登录已接入。');if(!po)w.push('previewOnly 字段异常，已安全降级');if(rec.writesDatabase===true)w.push('本地 mock 字段异常（writesDatabase=true），真实写入仍未启用');if(rec.callsRepository===true)w.push('本地 mock 字段异常（callsRepository=true），真实 repository 未被调用');" +
    "return{sk:'ready',at:auth===true?'true（仅本地 mock）':(auth===false?'false':'未提供'),art:ar===true?'true':(ar===false?'false':'未提供'),stt:stt===true?'true':(stt===false?'false':'未提供'),uid:uid,stx:stx,sst:sst,brt:brt,pot:po?'true':'false',sct:sct,ft:ft,swt:w.length>0?w.join('；'):null,hd:w.length>0};}" +
    "function rs(){var s=null;try{s=window.localStorage;if(!s)return buildUnavail();}catch(e){return buildUnavail();}var rv=null;try{rv=s.getItem(K);}catch(e){return buildUnavail();}if(rv===null||rv===undefined)return buildEmpty();var pv=null;try{pv=JSON.parse(rv);}catch(e){return buildDeg('本地 Auth Session 预览 JSON 不可解析，已安全降级。',null);}if(!isObj(pv))return buildDeg('本地 Auth Session 预览结构不兼容（值不是对象），已安全降级。',null);var rec=nr(pv);if(!rec)return buildDeg('本地 Auth Session 预览记录无法安全展示，已安全降级。',null);if(rec.sk==='blocked')return{sk:'degraded',st:'本地 Auth Session 预览已安全阻断',nt:C,ht:rec.bs,ft:rec.ft,rc:null};return{sk:rec.hd?'degraded':'ready',st:rec.hd?'已读取本地 Auth Session 预览，存在安全警告':'已读取本地 Auth Session 预览',nt:C,ht:'点击刷新可重新读取 localStorage。',ft:rec.ft,rc:rec};}" +
    "function buildEmpty(){return{sk:'empty',st:'暂无本地 Auth Session 预览',nt:C,ht:'请在 localStorage 中写入 lap.reader.authSession.preview 后点击刷新。',ft:null,rc:null};}" +
    "function buildUnavail(){return{sk:'unavailable',st:'本地 Auth Session 预览不可用',nt:C,ht:'当前环境无法读取 localStorage，已安全降级。',ft:null,rc:null};}" +
    "function buildDeg(ht,ft){return{sk:'degraded',st:'本地 Auth Session 预览已安全降级',nt:C,ht:nd(ht,140)||'本地 Auth Session 预览结构不兼容，已安全降级。',ft:ft||null,rc:null};}" +
    "function ee(id,tag,par){var n=document.getElementById(id);if(n)return n;n=document.createElement(tag);n.id=id;if(par)par.appendChild(n);return n;}" +
    "function ia(t,n){if(!t||!t.parentNode)return false;var p=t.parentNode;if(t.nextSibling)p.insertBefore(n,t.nextSibling);else p.appendChild(n);return true;}" +
    "var panel=document.getElementById('desktop-reader-auth-session-preview-panel');" +
    "if(!panel){panel=document.createElement('section');panel.id='desktop-reader-auth-session-preview-panel';panel.setAttribute('aria-live','polite');panel.style.marginTop='12px';panel.style.border='1px solid #d9dee7';panel.style.borderRadius='10px';panel.style.background='#f8fafc';panel.style.padding='12px';panel.style.boxShadow='0 1px 0 rgba(15,23,42,0.03)';" +
    "var an=document.getElementById('desktop-reader-idempotency-preview-panel')||document.getElementById('desktop-reader-write-preflight-preview-panel')||document.getElementById('desktop-reader-permission-gate-preview-panel')||document.getElementById('desktop-reader-audit-preview-panel')||document.getElementById('desktop-reader-sync-readiness-gate-panel')||document.getElementById('desktop-reader-sync-health-panel')||document.getElementById('desktop-navigation-shell');" +
    "if(!ia(an,panel))document.body.appendChild(panel);}" +
    "var tn=ee('desktop-reader-auth-session-preview-title','p',panel);tn.style.margin='0';tn.style.fontWeight='600';tn.textContent='Reader Auth Session（本地预览）';" +
    "var nn=ee('desktop-reader-auth-session-preview-note','p',panel);nn.style.marginTop='6px';nn.style.color='#5b6473';nn.style.fontSize='13px';nn.textContent=C;" +
    "var sn=ee('desktop-reader-auth-session-preview-status','p',panel);sn.style.marginTop='6px';sn.style.fontWeight='600';" +
    "var hn=ee('desktop-reader-auth-session-preview-hint','p',panel);hn.style.marginTop='6px';hn.style.color='#5b6473';hn.style.fontSize='13px';" +
    "var fn=ee('desktop-reader-auth-session-preview-filtered','p',panel);fn.style.marginTop='6px';fn.style.color='#5b6473';fn.style.fontSize='13px';fn.style.fontWeight='600';" +
    "var wn=ee('desktop-reader-auth-session-preview-warning','p',panel);wn.style.marginTop='10px';wn.style.background='#fff8e1';wn.style.border='1px solid #f3d06b';wn.style.color='#7a5600';wn.style.borderRadius='8px';wn.style.padding='10px 12px';wn.style.fontSize='13px';wn.style.display='none';" +
    "var bn=ee('desktop-reader-auth-session-preview-refresh-button','button',panel);bn.type='button';bn.textContent='刷新本地 Auth 预览';bn.style.display='inline-flex';bn.style.alignItems='center';bn.style.justifyContent='center';bn.style.border='1px solid #d9dee7';bn.style.borderRadius='8px';bn.style.background='#ffffff';bn.style.color='#1f2937';bn.style.fontWeight='600';bn.style.fontSize='14px';bn.style.minHeight='38px';bn.style.padding='0 14px';bn.style.cursor='pointer';bn.style.marginTop='10px';" +
    "var dn=ee('desktop-reader-auth-session-preview-details','ul',panel);dn.style.marginTop='12px';dn.style.listStyle='none';dn.style.paddingLeft='0';dn.style.display='grid';dn.style.gap='8px';" +
    "function br(l,v){var li=document.createElement('li');li.style.display='grid';li.style.gridTemplateColumns='200px 1fr';li.style.gap='8px';li.style.fontSize='14px';var ls=document.createElement('span');ls.style.color='#5b6473';ls.textContent=l;var vs=document.createElement('strong');vs.textContent=String(v);li.appendChild(ls);li.appendChild(vs);return li;}" +
    "function render(){var s=rs();sn.textContent=s.st;hn.textContent=s.ht;fn.textContent=s.ft||'';dn.innerHTML='';wn.style.display='none';wn.textContent='';" +
    "if(!s.rc){var ei=document.createElement('li');ei.style.color='#5b6473';ei.textContent='暂无 Auth Session 数据';dn.appendChild(ei);return s;}" +
    "var r=s.rc;var rows=[['authenticated',r.at],['authReady',r.art],['serverTrusted',r.stt],['serverUserId 预览（掩码）',r.uid],['authSource',r.stx],['sessionStatus',r.sst],['blockedReasons',r.brt],['previewOnly',r.pot],['safeToExposeToClient',r.sct]];" +
    "if(r.ft)rows.push(['敏感字段',r.ft]);for(var i=0;i<rows.length;i++)dn.appendChild(br(rows[i][0],rows[i][1]));" +
    "if(r.swt){wn.textContent=r.swt;wn.style.display='block';}return s;}" +
    "bn.onclick=function(){render();};render();return true;})();";
}

module.exports = {
  AUTH_SESSION_STORAGE_KEY,
  SAFE_AUTH_SESSION_COPY,
  maskServerUserIdPreview: maskUserId,
  resolveAuthSourceLabel: srcLabel,
  resolveSessionStatusLabel: sessLabel,
  normalizeAuthSessionPreviewRecord: normRecord,
  readAuthSessionPreviewFromStorage: readAuthSessionPreview,
  buildLocalReaderAuthSessionPreviewPanelScript: buildPanelScript,
};
