import Link from "next/link";
import { cookies } from "next/headers";

import { ProblemLibraryClient } from "./ProblemLibraryClient";
import { getFavoritesDbStatusForUi } from "../user/favorites-db-guard";
import { deserializeDevSession } from "../../lib/web-auth-dev-session";

export default async function ProblemsPage() {
  // Read dev session for DB favorites status
  let favDbEnabled = false;
  let devSessionOwnerId: string | null = null;
  try {
    const cookieStore = await cookies();
    const devSessionCookie = cookieStore.get("lap-web-dev-session")?.value;
    const favDbStatus = getFavoritesDbStatusForUi(devSessionCookie);
    favDbEnabled = favDbStatus.enabled;
    const session = deserializeDevSession(devSessionCookie);
    devSessionOwnerId = session?.userIdPreview ?? null;
  } catch {
    favDbEnabled = false;
    devSessionOwnerId = null;
  }

  return (
    <main className="learningPage">
      <header className="learningHero">
        <div>
          <p className="eyebrow">A387 Problem Center v1</p>
          <h1>题目中心</h1>
          <p className="status">
            内置示例题 · 用于练习路径演示 · 未接真实判题系统 · 不执行代码
          </p>
        </div>
        <div className="homeActions">
          <Link className="secondaryLink" href="/">
            返回首页
          </Link>
          <Link className="secondaryLink" href="/books">
            书库
          </Link>
          <Link className="secondaryLink" href="/user">
            用户中心
          </Link>
          <Link className="secondaryLink" href="/user/favorites/problems">
            收藏题目
          </Link>
          <Link className="secondaryLink" href="/user/recent-practice">
            最近刷题
          </Link>
        </div>
      </header>

      <section className="learningPanel" aria-labelledby="problem-list-title">
        <div className="panelHeader">
          <h2 id="problem-list-title">编程题目列表</h2>
          <p className="panelNote">
            当前共 10 道内置示例题，覆盖数组、哈希表、双指针、栈、BFS/DFS、动态规划、贪心、图论等常见算法主题。
            所有题目为用户自写，未引用 LeetCode/洛谷/Codeforces 等平台原题。
          </p>
        </div>
        <ProblemLibraryClient
          dbFavoritesEnabled={favDbEnabled}
          devSessionOwnerId={devSessionOwnerId}
        />
      </section>
    </main>
  );
}
