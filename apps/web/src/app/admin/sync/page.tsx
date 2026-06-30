/**
 * Admin Sync Management — Manual content refresh panel.
 *
 * Protected admin page for triggering daily hotspot and GitHub report syncs.
 * Displays last sync status, counts, and errors. No token or secret exposure.
 *
 * @adminDev — admin-only, not for regular users
 */

import {
  adminGetSyncStatus,
  adminRefreshArticles,
  adminRefreshGitHub,
  adminRefreshHotspots,
} from "./admin-sync-actions";
import { SyncManagementClient } from "./SyncManagementClient";

export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
  const status = await adminGetSyncStatus();

  return (
    <div>
      <div style={{ marginBottom: "var(--lap-space-6)" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#e2e8f0", margin: 0 }}>
          内容同步管理
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: "0.8125rem", color: "#94a3b8" }}>
          手动刷新每日技术热点、GitHub 日报和技术文章。刷新有冷却时间限制。
        </p>
      </div>

      <SyncManagementClient
        initialStatus={status}
        refreshHotspots={adminRefreshHotspots}
        refreshGitHub={adminRefreshGitHub}
        refreshArticles={adminRefreshArticles}
      />
    </div>
  );
}
