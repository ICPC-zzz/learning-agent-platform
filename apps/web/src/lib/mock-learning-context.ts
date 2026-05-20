export interface MockReadingProgress {
  progressRatio: number;
  currentChapterIndex: number;
  completedChunkCount: number;
  totalChunkCount: number;
}

export interface MockAbilityProfile {
  overallScore: number;
  algorithmScore: number;
  debuggingScore: number;
  systemDesignScore: number;
}

interface GetMockReadingProgressInput {
  currentChapterIndex: number;
  currentChapterChunkCount: number;
  totalChunkCount: number;
}

export function getMockReadingProgress({
  currentChapterIndex,
  currentChapterChunkCount,
  totalChunkCount
}: GetMockReadingProgressInput): MockReadingProgress {
  const safeTotalChunkCount = Math.max(totalChunkCount, 0);
  const safeChapterIndex = Math.max(currentChapterIndex, 0);
  const safeChapterChunkCount = Math.max(currentChapterChunkCount, 0);
  const completedChunkCount =
    safeTotalChunkCount === 0
      ? 0
      : Math.min(safeTotalChunkCount, safeChapterIndex + Math.min(safeChapterChunkCount, 1));

  return {
    progressRatio:
      safeTotalChunkCount === 0 ? 0 : completedChunkCount / safeTotalChunkCount,
    currentChapterIndex: safeChapterIndex,
    completedChunkCount,
    totalChunkCount: safeTotalChunkCount
  };
}

export const mockAbilityProfile: MockAbilityProfile = {
  overallScore: 68,
  algorithmScore: 54,
  debuggingScore: 72,
  systemDesignScore: 41
};
