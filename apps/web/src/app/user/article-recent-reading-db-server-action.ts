"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  evaluateArticleLibraryDbGuard,
} from "./article-library-db-guard";
import {
  doRecordArticleReading,
  type ArticleRecentReadingDbActionResult,
} from "./article-recent-reading-db-actions";

export async function recordArticleReadingDbAction(
  articleId: string,
  articleTitle: string,
  sourcePlatform: string,
  sourceName: string,
  originalUrl: string,
): Promise<ArticleRecentReadingDbActionResult> {
  let cookieValue: string | undefined;
  try {
    const cookieStore = await cookies();
    cookieValue = cookieStore.get("lap-web-dev-session")?.value;
  } catch {
    cookieValue = undefined;
  }

  const guard = evaluateArticleLibraryDbGuard(cookieValue);
  if (!guard.enabled || guard.sessionPayload === null) {
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
      ownerId: guard.sessionPayload.userIdPreview,
      lastReadAt: new Date(),
    },
    guard,
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
