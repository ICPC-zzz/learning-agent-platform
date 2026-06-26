import Link from "next/link";

import { loadAgentPermissionPreviewDetail } from "../../agent-permission-preview-detail";
import { AgentPermissionPreviewDetailPanel } from "../../agent-permission-preview-detail-panel";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type AgentPermissionDetailRouteParams = Readonly<{
  permissionRequestId?: string;
}>;

interface AgentPermissionDetailPageProps {
  params: Promise<AgentPermissionDetailRouteParams>;
}

export default async function AgentPermissionDetailPage({
  params,
}: AgentPermissionDetailPageProps) {
  const resolvedParams = await params;
  const detail = await loadAgentPermissionPreviewDetail(
    resolvedParams.permissionRequestId ?? "",
  );

  return (
    <main className={styles.shell}>
      <div className={styles.inner}>
        <div className={styles.topBar}>
          <Link className={styles.backLink} href="/agent">
            返回智能体工作台
          </Link>
          <span className={styles.previewPill}>
            权限预览详情只读
          </span>
        </div>

        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>智能体权限预览详情</p>
            <h1 className={styles.title}>已保存权限预览记录</h1>
            <p className={styles.description}>
              只读展示已保存的权限请求预览记录及其关联的权限决策预览记录。本页通过现有
              数据库仓库边界读取数据。
            </p>
          </div>
          <aside className={styles.safetyPanel} aria-label="详情安全边界">
            <p className={styles.safetyTitle}>真实权限流程已禁用</p>
            <p className={styles.safetyText}>
              这只是已保存的权限预览记录，不是真实权限请求、用户决策、授权、确认流程或
              执行日志。本页不会执行智能体任务、工具、模型调用、网络请求、记忆检索或
              Skill 操作。
            </p>
          </aside>
        </header>

        <AgentPermissionPreviewDetailPanel detail={detail} />
      </div>
    </main>
  );
}
