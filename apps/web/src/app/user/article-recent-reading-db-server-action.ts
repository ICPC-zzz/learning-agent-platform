"use server";

import { revalidatePath } from "next/cache";

import {
  evaluateArticleLibraryDbGuard,
} from "./article-library-db-guard";
import {
  doRecordArticleReading,
  type ArticleRecentReadingDbActionResult,
} from "./article-recent-reading-db-actions";
import { getCurrentAuthSession } from "../../lib/session/web-auth-session";

export async function recordArticleReadingDbAction(
  articleId: string,
  articleTitle: string,
  sourcePlatform: string,
  sourceName: string,
  originalUrl: string,
): Promise<ArticleRecentReadingDbActionResult> {
  const session = await getCurrentAuthSession();
  const guard = evaluateArticleLibraryDbGuard(undefined);
  if (!session.hasSession) {
    return {
      success: false,
      devOnly: true,
      writesDatabase: false,
      callsRepository: false,
      articleId: articleId || null,
      ownerIdPreview: null,
      reasonCode: "article-library-db-disabled-by-default",
      blockedReasons: [...guard.blockedReasons],
      productionReady: false,
    };
  }

  const result = await doRecordArticleReading(
    {
      articleId,
      articleTitle,
      sourcePlatform,
      sourceName,
      originalUrl,
      ownerId: session.userId,
      lastReadAt: new Date(),
    },
    { ...guard, enabled: true, callsRepository: true, sessionPayload: null },
  );

  if (result.success) {
    try {
      revalidatePath("/user");
      revalidatePath("/articles");
      revalidatePath("/user/recent-reading");
    } catch {
      // best effort
    }
  }

  return result;
}
