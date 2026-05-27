import styles from "./page.module.css";

const safetyBoundaryStatuses = [
  {
    label: "真实 LLM 调用",
    value: "未启用（mock-only）",
    description: "当前仅展示开发预览状态，不会发起真实模型请求。",
  },
  {
    label: "工具执行",
    value: "未启用（disabled-by-default）",
    description: "不注册、不调用、不执行任何真实工具。",
  },
  {
    label: "Agent loop",
    value: "未启用（preview-only）",
    description: "不会运行真实多步循环或后台执行。",
  },
  {
    label: "raw prompt / raw response 保存",
    value: "未启用",
    description: "不保存原始 prompt / response 内容。",
  },
  {
    label: "Provider 凭据读取",
    value: "未启用",
    description: "页面不会读取、展示或写入任何密钥。",
  },
  {
    label: "运行模式",
    value: "preview-only / mock-only / disabled-by-default",
    description: "所有状态仅用于开发预览，不代表真实可执行能力。",
  },
] as const;

const providerStatuses = [
  {
    label: "Mock Provider",
    value: "可用于预览（未真实执行）",
  },
  {
    label: "Spark Provider",
    value: "未接入（禁用）",
  },
  {
    label: "OpenAI Provider",
    value: "未接入（禁用）",
  },
  {
    label: "其他真实 Provider",
    value: "未接入（禁用）",
  },
  {
    label: "凭据状态",
    value: "页面不会读取或展示密钥",
  },
  {
    label: "调用状态",
    value: "本页面不会发起真实模型请求",
  },
] as const;

const disabledToolPreviewList = [
  {
    toolName: "文件系统工具",
    callPreview: "read/write/list 等调用预览元信息",
    status: "禁用（未真实执行）",
  },
  {
    toolName: "Shell / 命令执行",
    callPreview: "shell_command 调用预览元信息",
    status: "禁用（未真实执行）",
  },
  {
    toolName: "浏览器自动化",
    callPreview: "browser / web 操作预览元信息",
    status: "禁用（未真实执行）",
  },
  {
    toolName: "数据库写入工具",
    callPreview: "database_write 调用预览元信息",
    status: "禁用（未真实执行）",
  },
  {
    toolName: "网络请求工具",
    callPreview: "http/api 调用预览元信息",
    status: "禁用（未真实执行）",
  },
] as const;

const agentLoopDisabledNotes = [
  "当前不会自动规划多步任务。",
  "当前不会后台执行。",
  "当前不会跨页面写入数据。",
  "当前只展示预览信息和安全边界。",
  "后续若接入真实 loop，需要单独权限与审计。",
] as const;

interface AgentSafetyBoundaryPanelProps {
  modeLabel: string;
}

export function AgentSafetyBoundaryPanel({
  modeLabel,
}: AgentSafetyBoundaryPanelProps) {
  return (
    <section className={styles.section} aria-labelledby="agent-safety-boundary">
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle} id="agent-safety-boundary">
            Agent 安全边界（开发预览）
          </h2>
          <p className={styles.sectionNote}>
            该区域仅用于可视化安全边界与 mock 元信息，不会激活真实能力。
          </p>
        </div>
      </div>

      <div className={styles.planDetailsGrid}>
        <article className={styles.planDetailPanel} aria-label="安全边界状态">
          <h3 className={styles.detailTitle}>关键能力状态</h3>
          <div className={styles.providerRows}>
            {safetyBoundaryStatuses.map((item) => (
              <ProviderRow
                key={item.label}
                label={item.label}
                value={item.value}
              />
            ))}
            <ProviderRow
              label="当前 URL 模式"
              value={`${modeLabel}（仍为开发预览）`}
            />
          </div>
          <ul className={styles.safetyNotes}>
            {safetyBoundaryStatuses.map((item) => (
              <li key={`${item.label}-description`}>{item.description}</li>
            ))}
          </ul>
        </article>

        <article className={styles.planDetailPanel} aria-label="模型 Provider 状态">
          <h3 className={styles.detailTitle}>模型 Provider 状态</h3>
          <div className={styles.providerRows}>
            {providerStatuses.map((item) => (
              <ProviderRow
                key={item.label}
                label={item.label}
                value={item.value}
              />
            ))}
          </div>
          <p className={styles.disabledReason}>
            提示：本页仅显示开发预览状态，不读取 .env、不读取 testapi、不展示任何
            secret。
          </p>
        </article>
      </div>

      <article className={styles.planPreviewCard} aria-label="工具调用预览">
        <div className={styles.planHeader}>
          <div>
            <h3 className={styles.planTitle}>禁用工具列表 / 工具调用预览列表</h3>
            <p className={styles.planSummary}>
              以下仅为静态 mock 元信息，用于说明潜在调用面，不代表已注册或可执行。
            </p>
          </div>
        </div>
        <ol className={styles.stepList}>
          {disabledToolPreviewList.map((item) => (
            <li className={styles.stepItem} key={item.toolName}>
              <p className={styles.stepTitle}>{item.toolName}</p>
              <p className={styles.stepDescription}>调用预览：{item.callPreview}</p>
              <div className={styles.stepFacts}>
                <span>{item.status}</span>
                <span>mock-only</span>
                <span>disabled-by-default</span>
              </div>
            </li>
          ))}
        </ol>
      </article>

      <article className={styles.planPreviewCard} aria-label="Agent loop 状态">
        <div className={styles.planHeader}>
          <div>
            <h3 className={styles.planTitle}>Agent loop 状态（开发预览）</h3>
            <p className={styles.planSummary}>
              Agent loop 仅做边界说明，当前不会触发真实执行。
            </p>
          </div>
        </div>
        <ul className={styles.safetyNotes}>
          {agentLoopDisabledNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </article>
    </section>
  );
}

function ProviderRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.providerRow}>
      <span className={styles.providerLabel}>{label}</span>
      <span className={styles.providerValue}>{value}</span>
    </div>
  );
}
