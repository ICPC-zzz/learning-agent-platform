const fs = require("fs");
const content = fs.readFileSync("apps/desktop/local-learning-status-panel.js", "utf-8");

const fb = content.indexOf(String.fromCharCode(96));
const lb = content.lastIndexOf(String.fromCharCode(96));
const before = content.substring(0, fb + 1);
const after = content.substring(lb);

function countBraces(text) {
    let b = 0;
    let inStr = false;
    let strCh = "";
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inStr) {
            if (ch === "\\") { i++; continue; }
            if (ch === strCh) inStr = false;
            continue;
        }
        if (ch === "\"" || ch === "'" || ch === String.fromCharCode(96)) {
            inStr = true;
            strCh = ch;
            continue;
        }
        if (ch === "{") b++;
        if (ch === "}") b--;
    }
    return b;
}

console.log("Before template balance:", countBraces(before));
console.log("After template balance:", countBraces(after));
console.log("Total:", countBraces(before) + countBraces(after));
