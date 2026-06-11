const fs = require("fs");
const content = fs.readFileSync("apps/desktop/local-learning-status-panel.js", "utf-8");

const fb = content.indexOf("\x60"); // backtick
const lb = content.lastIndexOf("\x60");
const template = content.substring(fb + 1, lb);

const lines = template.split("\n");
let balance = 0;

for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const startBalance = balance;
    let inStr = false;
    let strChar = "";
    for (let ci = 0; ci < line.length; ci++) {
        const ch = line[ci];
        if (inStr) {
            if (ch === "\\") { ci++; continue; }
            if (ch === strChar) inStr = false;
            continue;
        }
        if (ch === "\"" || ch === "'") {
            inStr = true;
            strChar = ch;
            continue;
        }
        if (ch === "{") balance++;
        if (ch === "}") balance--;
    }
    if (balance !== startBalance) {
        console.log("L" + (li+1) + " [" + startBalance + "->" + balance + "]: " + line.substring(0, 90));
    }
}
console.log("Final:", balance);
