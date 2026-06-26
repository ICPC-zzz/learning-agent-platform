import { cookies } from "next/headers";
import Link from "next/link";

import { deserializeDevSession } from "../../../lib/web-auth-dev-session";
import { loadDbProblemPractice } from "../problem-practice-db-loader";
import { RecentPracticePageClient } from "./RecentPracticePageClient";

export default async function RecentPracticePage() {
  let hasSession = false;
  let dbPracticeEnabled = false;
  let dbItems: import("../problem-practice-db-loader").DbProblemPracticeView[] = [];
  let dbMessage = "";

  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    const session = deserializeDevSession(raw);
    hasSession = session !== null && session.userIdPreview.length > 0;

    const dbResult = await loadDbProblemPractice(raw);
    dbPracticeEnabled = dbResult.guardEnabled;
    dbItems = dbResult.items;
    dbMessage = dbResult.message;
  } catch {
    hasSession = false;
    dbPracticeEnabled = false;
    dbItems = [];
    dbMessage = "DB practice loader failed. Using local fallback.";
  }

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A387 Recent Practice v1</p>
          <h1>最近刷题</h1>
          <p className="status">
            dev-only · local fallback · 未接生产同步 · 未接真实判题
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/user">
            ← 返回用户中心
          </Link>
          <Link className="secondaryLink" href="/problems">
            题目中心
          </Link>
          <Link className="secondaryLink" href="/user/favorites/problems">
            收藏题目
          </Link>
        </div>
      </header>

      <section className="learningPanel" aria-labelledby="recent-practice-title">
        <div className="panelHeader">
          <h2 id="recent-practice-title">练习记录</h2>
          <p className="panelNote">
            {dbPracticeEnabled
              ? `开发 DB 练习记录已启用。${dbMessage}`
              : "DB 练习记录未启用，使用本地存储。"}
          </p>
        </div>
        <RecentPracticePageClient
          dbPractice={dbItems}
          dbPracticeEnabled={dbPracticeEnabled}
          hasSession={hasSession}
        />
      </section>

      <div
        style={{
          marginTop: "16px",
          padding: "10px 14px",
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: "6px",
          fontSize: "12px",
          color: "#92400e",
        }}
      >
        注意：练习记录 v1。不执行代码，不接真实判题。DB 持久化需 5 层显式授权门。
        数据优先存储在浏览器本地。所有数据未接生产账号同步。
      </div>
    </main>
  );
}
