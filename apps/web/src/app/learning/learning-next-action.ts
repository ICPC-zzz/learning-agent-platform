import { buildReaderHref } from "./learning-reader-link";
import type { LearningReaderLocalStatusSummary } from "./learning-reader-local-status";

const READER_ENTRY_HREF = "/reader";

export interface LearningNextAction {
  title: string;
  description: string;
  reason: string;
  href: string;
  actionLabel: string;
  badges: string[];
  metadata: string[];
  previewOnly: true;
}

function resolveReaderHref(summary: LearningReaderLocalStatusSummary): string {
  return buildReaderHref(summary.bookId, summary.chapterId) ?? READER_ENTRY_HREF;
}

function formatProgressText(progressPercent: number | null): string {
  if (progressPercent === null) {
    return "进度未知";
  }

  return `当前进度 ${Math.round(progressPercent)}%`;
}

function getReadingTimeHint(readingSeconds: number): string {
  if (readingSeconds < 600) {
    return "建议先进行 10~15 分钟短时专注阅读。";
  }

  return "保持当前节奏，完成本次学习行动。";
}

export function createLearningNextAction(
  summary: LearningReaderLocalStatusSummary | null,
): LearningNextAction {
  if (summary === null) {
    return {
      title: "先打开 Reader 选择一本书开始阅读",
      description: "当前浏览器还没有可用的本地阅读摘要，先进入 Reader 建立学习记录。",
      reason: "未检测到 lap.reader.localStatus.v1，本地规则无法推导章节进度。",
      href: READER_ENTRY_HREF,
      actionLabel: "前往 Reader",
      badges: ["开发预览", "本地规则推导"],
      metadata: ["无本地摘要", "local-only", "no DB sync"],
      previewOnly: true,
    };
  }

  const progressPercent = summary.progressPercent;
  const progressText = formatProgressText(progressPercent);
  const readingHint = getReadingTimeHint(summary.readingSeconds);
  const reasons: string[] = [
    `根据本地摘要推导：${progressText}，笔记 ${summary.noteCount} 条，书签 ${summary.bookmarkCount} 条。`,
  ];

  if (summary.noteCount === 0) {
    reasons.push("当前还没有本地笔记。");
  }

  if (summary.bookmarkCount > 0) {
    reasons.push("已有书签，可从关键位置继续。");
  }

  if (summary.readingSeconds < 600) {
    reasons.push("累计阅读时长较短，建议补一段 10~15 分钟专注阅读。");
  }

  if (progressPercent !== null && progressPercent >= 80) {
    return {
      title: "回顾本章笔记/书签，准备进入下一章",
      description: `当前章节已接近完成。${readingHint}`,
      reason: reasons.join(" "),
      href: resolveReaderHref(summary),
      actionLabel: "回到 Reader 复盘",
      badges: ["开发预览", "本地规则推导"],
      metadata: [progressText, `笔记 ${summary.noteCount}`, `书签 ${summary.bookmarkCount}`],
      previewOnly: true,
    };
  }

  if (progressPercent !== null && progressPercent >= 30) {
    return {
      title: "继续阅读并补充 1 条笔记或书签",
      description: `章节已进入中段。${readingHint}`,
      reason: reasons.join(" "),
      href: resolveReaderHref(summary),
      actionLabel: "继续阅读",
      badges: ["开发预览", "本地规则推导"],
      metadata: [progressText, `笔记 ${summary.noteCount}`, `书签 ${summary.bookmarkCount}`],
      previewOnly: true,
    };
  }

  return {
    title: "继续完成本章前 30% 阅读",
    description: `建议先把当前章节推进到 30% 左右。${readingHint}`,
    reason: reasons.join(" "),
    href: resolveReaderHref(summary),
    actionLabel: "继续阅读",
    badges: ["开发预览", "本地规则推导"],
    metadata: [progressText, `笔记 ${summary.noteCount}`, `书签 ${summary.bookmarkCount}`],
    previewOnly: true,
  };
}
