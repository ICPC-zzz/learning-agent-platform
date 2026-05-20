import type { ReadingProgressRecord } from "@learning-agent-platform/db";
import type { ReadingEvent } from "@learning-agent-platform/learning-engine";

export interface ReadingProgressSignalRecordSummary {
  progressCount: number;
  completedChapterCount: number;
  activeBookCount: number;
  latestProgressUpdatedAt?: string;
}

export function mapReadingProgressRecordToLearningEvent(
  record: ReadingProgressRecord,
): ReadingEvent {
  return {
    id: record.id,
    userId: record.userId,
    type: "reading_progress",
    bookId: record.bookId,
    chapterId: record.chapterId,
    progressRatio: record.progressRatio,
    occurredAt: record.updatedAt,
  };
}

export function mapReadingProgressRecordsToLearningEvents(
  records: readonly ReadingProgressRecord[],
): readonly ReadingEvent[] {
  return records.map(mapReadingProgressRecordToLearningEvent);
}

export function summarizeReadingProgressRecords(
  records: readonly ReadingProgressRecord[],
): ReadingProgressSignalRecordSummary {
  const completedChapterIds = new Set<string>();
  const activeBookIds = new Set<string>();
  let latestUpdatedAt: Date | undefined;

  for (const record of records) {
    activeBookIds.add(record.bookId);

    if (record.completedAt !== null || record.progressRatio >= 1) {
      completedChapterIds.add(record.chapterId);
    }

    if (
      latestUpdatedAt === undefined ||
      record.updatedAt.getTime() > latestUpdatedAt.getTime()
    ) {
      latestUpdatedAt = record.updatedAt;
    }
  }

  return {
    progressCount: records.length,
    completedChapterCount: completedChapterIds.size,
    activeBookCount: activeBookIds.size,
    latestProgressUpdatedAt: latestUpdatedAt?.toISOString(),
  };
}
