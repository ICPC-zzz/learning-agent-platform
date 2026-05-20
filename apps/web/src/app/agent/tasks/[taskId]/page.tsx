import Link from "next/link";

import { loadAgentPreviewTaskDetail } from "../../agent-preview-task-detail";
import { AgentPreviewTaskDetailPanel } from "../../agent-preview-task-detail-panel";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type AgentTaskDetailRouteParams = Readonly<{
  taskId?: string;
}>;

interface AgentTaskDetailPageProps {
  params: Promise<AgentTaskDetailRouteParams>;
}

export default async function AgentTaskDetailPage({
  params,
}: AgentTaskDetailPageProps) {
  const resolvedParams = await params;
  const detail = await loadAgentPreviewTaskDetail(resolvedParams.taskId ?? "");

  return (
    <main className={styles.shell}>
      <div className={styles.inner}>
        <div className={styles.topBar}>
          <Link className={styles.backLink} href="/agent">
            返回智能体工作台
          </Link>
          <span className={styles.previewPill}>预览详情只读</span>
        </div>

        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>智能体任务预览详情</p>
            <h1 className={styles.title}>已保存任务预览记录</h1>
            <p className={styles.description}>
              只读展示已保存的智能体预览记录。本页通过现有数据库仓库边界读取任务、
              快照和事件。
            </p>
          </div>
          <aside className={styles.safetyPanel} aria-label="详情安全边界">
            <p className={styles.safetyTitle}>真实执行已禁用</p>
            <p className={styles.safetyText}>
              这只是已保存的预览记录，不是执行日志或授权记录。本页不会执行智能体任务、
              工具、模型调用、网络请求、记忆检索或 Skill 操作。
            </p>
          </aside>
        </header>

        <AgentPreviewTaskDetailPanel detail={detail} />
      </div>
    </main>
  );
}
