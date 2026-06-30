import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHustojListUrl,
  buildHustojProblemUrl,
  parseHustojProblemListPage,
  parseHustojProblemPage,
} from "./hustoj-problem-parser.mjs";

test("builds hustoj urls", () => {
  assert.equal(
    buildHustojListUrl("http://tk.hustoj.com", "free", 2),
    "http://tk.hustoj.com/problemset.php?search=free&page=2",
  );
  assert.equal(
    buildHustojProblemUrl("http://tk.hustoj.com", 1000),
    "http://tk.hustoj.com/problem.php?id=1000",
  );
});

test("parses hustoj problem list rows", () => {
  const html = `
    <table>
      <tr>
        <td><a href='problem.php?id=1000'>A + B Problem</a></td>
      </tr>
      <tr>
        <td><a href="problem.php?id=1001"><span>B</span> Problem</a></td>
      </tr>
    </table>
  `;

  const rows = parseHustojProblemListPage(html);
  assert.deepEqual(rows, [
    { problemId: "1000", title: "A + B Problem" },
    { problemId: "1001", title: "B Problem" },
  ]);
});

test("parses hustoj problem page sections", () => {
  const html = `
    <html>
      <body>
        <div id="description" class="ui bottom attached segment font-content">
          <p>题面 <strong>内容</strong></p>
          <div class="nested"><span>保留结构</span></div>
        </div>
        <div id="input" class="ui bottom attached segment font-content">
          <p>输入说明</p>
        </div>
        <div id="output" class="ui bottom attached segment font-content">
          <p>输出说明</p>
        </div>
        <div class="ui bottom attached segment font-content">
          <pre><code id="sinput" class="lang-plain">1 2</code></pre>
        </div>
        <div class="ui bottom attached segment font-content">
          <pre><code id="soutput" class="lang-plain">3</code></pre>
        </div>
        <div id="hint" class="ui bottom attached segment font-content hint">
          <p>提示信息</p>
        </div>
        <div fd="source" pid="1000" class="ui bottom attached segment">
          <a href="problemset.php?search=dp">dp</a>
          <a href="problemset.php?search=math">math</a>
        </div>
      </body>
    </html>
  `;

  const parsed = parseHustojProblemPage(html, "Sample Title");
  assert.equal(parsed.title, "Sample Title");
  assert.match(parsed.statement ?? "", /题面/);
  assert.match(parsed.statement ?? "", /内容/);
  assert.match(parsed.statement ?? "", /保留结构/);
  assert.equal(parsed.inputDescription, "输入说明");
  assert.equal(parsed.outputDescription, "输出说明");
  assert.equal(parsed.sampleInput, "1 2");
  assert.equal(parsed.sampleOutput, "3");
  assert.equal(parsed.hint, "提示信息");
  assert.deepEqual(parsed.sourceLabels, ["dp", "math"]);
  assert.deepEqual(parsed.examples, [{ input: "1 2", output: "3" }]);
});
