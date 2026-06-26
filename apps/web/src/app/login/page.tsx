/**
 * /login — Dev login page.
 *
 * Displays different UI based on whether dev auth guard is enabled:
 * - Guard OFF: shows blocked message + instructions
 * - Guard ON: shows dev login form
 *
 * Designation: 开发登录 · 未接生产认证 · 不写数据库
 */
import { getDevAuthGuardStatus } from "../../lib/web-auth-dev-guard";
import { DevLoginForm } from "../../components/auth/DevLoginForm";
import Link from "next/link";

export default function LoginPage() {
  const guard = getDevAuthGuardStatus();

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A376 Auth Session v1</p>
          <h1>开发登录</h1>
          <p className="status">
            未接生产认证 · 不会写入数据库 · 仅用于本地开发验证用户中心
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/">
            返回首页
          </Link>
          <Link className="secondaryLink" href="/user">
            用户中心
          </Link>
        </div>
      </header>

      <section className="learningPanel" aria-labelledby="login-section-title">
        <div className="panelHeader">
          <p className="eyebrow">
            {guard.enabled ? "Dev Auth 已启用" : "Dev Auth 未启用"}
          </p>
          <h2 id="login-section-title">
            {guard.enabled ? "选择开发用户身份" : "开发登录未启用"}
          </h2>
        </div>

        {guard.enabled ? (
          <DevLoginForm />
        ) : (
          <div className="learningEmptyState" aria-live="polite">
            <strong>开发登录功能当前已关闭</strong>
            <p>
              环境变量 <code>LAP_WEB_AUTH_DEV_ENABLED</code> 未设置为 <code>true</code>。
              开发登录默认关闭，不会创建 session。
            </p>
            <p style={{ marginTop: "8px", fontSize: "12px", color: "#64748b" }}>
              如需启用开发登录，请在 <code>.env</code> 或环境变量中设置：
              <br />
              <code>LAP_WEB_AUTH_DEV_ENABLED=true</code>
            </p>
          </div>
        )}

        {/* Always show safety disclaimer */}
        <div
          style={{
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: "8px",
            color: "#92400e",
            fontSize: "12px",
            marginTop: "16px",
            padding: "10px 14px",
          }}
        >
          <strong>⚠ 安全提示：</strong>本页面仅用于本地开发验证。不接真实 OAuth/密码登录，
          不写入数据库，不暴露 secret。所有会话均为 dev-only，不具备生产安全级别。
        </div>
      </section>
    </main>
  );
}
