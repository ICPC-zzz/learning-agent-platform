import Link from "next/link";

import {
  evaluateReaderAiQaGuard,
  READER_AI_QA_AUTH_ENV_KEYS,
  READER_AI_QA_REQUIRED_ENV_KEYS,
} from "../reader/reader-ai-qa-guard";
import { ReaderAiQuestionPanel } from "../reader/ReaderAiQuestionPanel";

const sampleChapterContent = `Chapter 1: Testing the external provider

This sample chapter exists only to provide a stable reader QA entry point.
It includes a tiny code example so the prompt has something concrete to use:

\`\`\`ts
export function add(a: number, b: number) {
  return a + b;
}
\`\`\`

The goal is to verify that the Reader QA flow can call a configured
OpenAI-compatible or Spark-compatible dev provider without touching the DB.`;

const sampleCodeBlockSummaries = [
  "A small add(a, b) helper that returns the sum of two numbers.",
  "The example is intentionally tiny so the question panel can be tested fast.",
];

function readGuardSnapshot() {
  return evaluateReaderAiQaGuard({
    NODE_ENV: process.env.NODE_ENV,
    LAP_WEB_LLM_QA_DEV_ENABLED: process.env.LAP_WEB_LLM_QA_DEV_ENABLED,
    LAP_READER_AI_QA_DEV_ENABLED: process.env.LAP_READER_AI_QA_DEV_ENABLED,
    LAP_ALLOW_EXTERNAL_LLM_PROVIDER: process.env.LAP_ALLOW_EXTERNAL_LLM_PROVIDER,
    LAP_LLM_DEV_ENDPOINT: process.env.LAP_LLM_DEV_ENDPOINT,
    LAP_LLM_DEV_API_KEY: process.env.LAP_LLM_DEV_API_KEY,
    LAP_LLM_DEV_APIPassword: process.env.LAP_LLM_DEV_APIPassword,
    LAP_LLM_DEV_MODEL: process.env.LAP_LLM_DEV_MODEL,
  });
}

export default function AskPage() {
  const guard = readGuardSnapshot();
  const isReady = guard.allowed && guard.mode === "external_dev";
  const checkedEnvKeys = [
    ...READER_AI_QA_REQUIRED_ENV_KEYS,
    ...READER_AI_QA_AUTH_ENV_KEYS,
  ];

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">开发预览 · AI 提问</p>
          <h1>真实 LLM 测试入口</h1>
          <p className="status">
            这个页面是一个稳定的最小入口，用来测试已配置的讯飞星火或
            OpenAI-compatible dev provider，不写 DB，不走 Agent。
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/">
            返回首页
          </Link>
          <Link className="secondaryLink" href="/ai">
            打开 AI 助手
          </Link>
        </div>
        <p className="panelNote" style={{ marginTop: 8, color: "#6366f1", fontSize: "12px" }}>
          本页为独立测试入口；完整 AI 助手请使用 /ai 主页面，复用同一 guard 与 provider 管线。
        </p>
      </header>

      <section className="learningPanel">
        <div className="panelHeader">
          <h2>环境检查</h2>
        </div>
        <p className="panelNote">
          本页检查的环境变量名：{checkedEnvKeys.join(", ")}。认证材料只要
          `LAP_LLM_DEV_API_KEY` 或 `LAP_LLM_DEV_APIPassword` 其一可用即可。
        </p>
        <div
          style={{
            marginTop: 12,
            padding: 16,
            border: "1px solid #d8dee8",
            borderRadius: 8,
            background: "#fbfcfe",
          }}
        >
          <p style={{ margin: 0, fontWeight: 700 }}>
            {isReady ? "external_dev 可用" : "blocked"}
          </p>
          <p style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
            {guard.notice}
          </p>
          {guard.missingEnvKeys.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ margin: 0, fontWeight: 700 }}>缺少的环境变量</p>
              <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
                {guard.missingEnvKeys.map((key) => (
                  <li key={key}>{key}</li>
                ))}
              </ul>
            </div>
          )}
          {!guard.nonProduction && (
            <p style={{ margin: "12px 0 0", color: "#92400e" }}>
              NODE_ENV 当前是 production，所以真实 provider 被阻止。
            </p>
          )}
        </div>
      </section>

      <section className="learningPanel">
        <div className="panelHeader">
          <h2>问答面板</h2>
        </div>
        <ReaderAiQuestionPanel
          bookId="dev-ask"
          chapterId="sample-chapter"
          bookTitle="Development Preview Book"
          chapterTitle="External Provider Test Chapter"
          chapterContent={sampleChapterContent}
          codeBlockSummaries={sampleCodeBlockSummaries}
        />
      </section>
    </main>
  );
}
