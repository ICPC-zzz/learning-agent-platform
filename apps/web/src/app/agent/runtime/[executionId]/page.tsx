import Link from "next/link";

import {
  RuntimePreviewSafetyLabels,
  extendedRuntimePreviewSafetyLabels,
} from "../../runtime-preview-safety-labels";
import { RuntimePreviewDetail } from "./_components/runtime-preview-detail";
import { loadAgentRuntimePreviewDetail } from "./_lib/runtime-preview-detail-loader";
import styles from "../../page.module.css";

export const dynamic = "force-dynamic";

type AgentRuntimeDetailRouteParams = Readonly<{
  executionId?: string;
}>;

interface AgentRuntimeDetailPageProps {
  params: Promise<AgentRuntimeDetailRouteParams>;
}

export default async function AgentRuntimeDetailPage({
  params,
}: AgentRuntimeDetailPageProps) {
  const resolvedParams = await params;
  const detail = await loadAgentRuntimePreviewDetail(
    resolvedParams.executionId ?? "",
  );

  return (
    <main className={styles.shell}>
      <div className={styles.inner}>
        <div className={styles.topBar}>
          <Link className={styles.backLink} href="/agent">
            返回智能体工作台
          </Link>
          <span className={styles.previewPill}>只读运行预览详情</span>
        </div>

        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>智能体运行预览详情</p>
            <h1 className={styles.title}>智能体运行预览详情</h1>
            <p className={styles.description}>
              该页面只展示一次智能体运行预览记录。它不代表任务已经真实执行，
              也没有执行工具、调用模型或产生真实副作用。
            </p>
            <RuntimePreviewSafetyLabels
              labels={extendedRuntimePreviewSafetyLabels}
            />
          </div>
          <aside className={styles.safetyPanel} aria-label="运行预览安全边界">
            <p className={styles.safetyTitle}>真实运行未启用</p>
            <p className={styles.safetyText}>
              当前只读页面不会保存新记录，不会启动真实运行，不会产生工具动作，
              不会发起模型请求，也不会捕获真实权限确认。取消、超时、重试仍只是策略预览。
            </p>
          </aside>
        </header>

        <RuntimePreviewDetail detail={detail} />
      </div>
    </main>
  );
}
