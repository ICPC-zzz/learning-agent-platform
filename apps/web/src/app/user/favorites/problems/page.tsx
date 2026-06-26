import { cookies } from "next/headers";
import Link from "next/link";

import { deserializeDevSession } from "../../../../lib/web-auth-dev-session";
import { loadDbProblemFavorites } from "../../problem-favorites-db-loader";
import { FavoriteProblemsPageClient } from "./FavoriteProblemsPageClient";

export default async function FavoriteProblemsPage() {
  let hasSession = false;
  let dbFavoritesEnabled = false;
  let dbItems: import("../../problem-favorites-db-loader").DbProblemFavoriteView[] = [];
  let dbMessage = "";

  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get("lap-web-dev-session")?.value;
    const session = deserializeDevSession(raw);
    hasSession = session !== null && session.userIdPreview.length > 0;

    const dbResult = await loadDbProblemFavorites(raw);
    dbFavoritesEnabled = dbResult.guardEnabled;
    dbItems = dbResult.items;
    dbMessage = dbResult.message;
  } catch {
    hasSession = false;
    dbFavoritesEnabled = false;
    dbItems = [];
    dbMessage = "DB favorites loader failed. Using local fallback.";
  }

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A387 Problem Favorites v1</p>
          <h1>收藏题目</h1>
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
          <Link className="secondaryLink" href="/user/recent-practice">
            最近刷题
          </Link>
        </div>
      </header>

      <section className="learningPanel" aria-labelledby="fav-problems-title">
        <div className="panelHeader">
          <h2 id="fav-problems-title">我的收藏题目</h2>
          <p className="panelNote">
            {dbFavoritesEnabled
              ? `开发 DB 收藏已启用。${dbMessage}`
              : "DB 收藏未启用，使用本地存储。"}
          </p>
        </div>
        <FavoriteProblemsPageClient
          dbFavorites={dbItems}
          dbFavoritesEnabled={dbFavoritesEnabled}
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
        注意：题目收藏 v1。DB 持久化需 5 层显式授权门。数据优先存储在浏览器本地。
        所有数据未接生产账号同步。题目系统未接真实判题。
      </div>
    </main>
  );
}
