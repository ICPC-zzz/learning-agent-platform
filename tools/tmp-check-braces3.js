const fs = require("fs");
const content = fs.readFileSync("apps/desktop/local-learning-status-panel.js", "utf-8");

const bt = String.fromCharCode(96); // backtick
const fb = content.indexOf(bt);
const before = content.substring(0, fb + 1);

// Find all function definitions in module-level code
const funcPattern = /function (\w+)\(/g;
let m;
let lastIdx = 0;
const funcs = [];
while ((m = funcPattern.exec(before)) !== null) {
    if (m.index > lastIdx) {
        funcs.push({ name: m[1], start: m.index });
        lastIdx = m.index;
    }
}

// For each function, count braces from its start to fb
for (let i = 0; i < funcs.length; i++) {
    const fn = funcs[i];
    const nextStart = i + 1 < funcs.length ? funcs[i + 1].start : fb;
    const section = before.substring(fn.start, nextStart);

    let b = 0;
    let inStr = false;
    let strCh = "";
    let inBt = false;
    for (let j = 0; j < section.length; j++) {
        const ch = section[j];
        if (inBt) {
            if (ch === "\\") { j++; continue; }
            if (ch === bt) { inBt = false; j++; continue; }
            continue;
        }
        if (inStr) {
            if (ch === "\\") { j++; continue; }
            if (ch === strCh) inStr = false;
            continue;
        }
        if (ch === bt) { inBt = true; continue; }
        if (ch === "\"" || ch === "'") { inStr = true; strCh = ch; continue; }
        if (ch === "{") b++;
        if (ch === "}") b--;
    }
    if (b !== 0) {
        console.log(fn.name + ": balance = " + b);
    }
}

// Also check total
let totalB = 0;
let inStr2 = false;
let strCh2 = "";
let inBt2 = false;
for (let j = 0; j < before.length; j++) {
    const ch = before[j];
    if (inBt2) {
        if (ch === "\\") { j++; continue; }
        if (ch === bt) { inBt2 = false; j++; continue; }
        continue;
    }
    if (inStr2) {
        if (ch === "\\") { j++; continue; }
        if (ch === strCh2) inStr2 = false;
        continue;
    }
    if (ch === bt) { inBt2 = true; continue; }
    if (ch === "\"" || ch === "'") { inStr2 = true; strCh2 = ch; continue; }
    if (ch === "{") totalB++;
    if (ch === "}") totalB--;
}
console.log("Total before template:", totalB);
