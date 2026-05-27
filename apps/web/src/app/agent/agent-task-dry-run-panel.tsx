"use client";

import { useState } from "react";

import styles from "./page.module.css";

interface DryRunStep {
  id: string;
  name: string;
  description: string;
  status: "mock-only / disabled / preview-only";
}

type PresetTaskId =
  | "explain-closure"
  | "weekly-learning-plan"
  | "chapter-key-points";

type ContextReferenceStatus =
  | "mock-only"
  | "preview-only"
  | "disabled"
  | "disabled-by-default"
  | "mock provider only";

interface ContextReferenceCard {
  id: string;
  name: string;
  status: ContextReferenceStatus;
  description: string;
  isActuallyRead: false;
  writesToDatabase: false;
}

type PermissionCheckStatus = "预览占位" | "禁用";

interface PermissionCheckPreviewItem {
  id: string;
  name: string;
  status: PermissionCheckStatus;
  isActuallyAuthorized: false;
  description: string;
}

interface RiskConfirmationPreviewItem {
  id: string;
  name: string;
  status: string;
  description: string;
}

interface AnswerDraftSection {
  id: string;
  title: string;
  description: string;
}

interface DryRunAnswerDraftPreview {
  title: string;
  taskUnderstanding: string;
  planSummary: string;
  possibleAnswerStructure: readonly AnswerDraftSection[];
  pendingConfirmationQuestions: readonly string[];
  safetyStatement: string;
}

interface DryRunExecutionConfirmationItem {
  id: string;
  name: string;
  summary: string;
  status: string;
  extraCheckLabel: string;
  extraCheckValue: string;
  isActuallyExecuted: false;
  callsRealModel: false;
  writesToDatabase: false;
  requiresRealAuthorization: false;
}

interface DryRunExecutionConfirmationPreview {
  presetSpecificNote: string;
  items: readonly DryRunExecutionConfirmationItem[];
}

interface PresetTask {
  id: PresetTaskId;
  title: string;
  taskText: string;
}

const presetTasks: readonly PresetTask[] = [
  {
    id: "explain-closure",
    title: "解释闭包",
    taskText: "解释闭包",
  },
  {
    id: "weekly-learning-plan",
    title: "设计一周学习计划",
    taskText: "设计一周学习计划",
  },
  {
    id: "chapter-key-points",
    title: "分析当前章节重点",
    taskText: "分析当前章节重点",
  },
];

function buildDefaultDryRunSteps(taskText: string): DryRunStep[] {
  return [
    {
      id: "step-context",
      name: "读取当前页面上下文（预览）",
      description: `根据任务“${taskText}”生成上下文参考草案，仅用于前端 dry-run 展示。`,
      status: "mock-only / disabled / preview-only",
    },
    {
      id: "step-goal",
      name: "检查用户学习目标（mock）",
      description:
        "使用静态规则模拟目标检查，不读取真实学习档案或历史记录。",
      status: "mock-only / disabled / preview-only",
    },
    {
      id: "step-materials",
      name: "规划需要参考的资料（不真实读取）",
      description:
        "只展示可能需要的资料类型，不触发文件系统读取或网络请求。",
      status: "mock-only / disabled / preview-only",
    },
    {
      id: "step-draft",
      name: "生成回答草稿计划（不调用模型）",
      description:
        "展示回答结构与步骤，不调用任何真实 LLM Provider。",
      status: "mock-only / disabled / preview-only",
    },
    {
      id: "step-tools",
      name: "标记可能需要的工具（工具禁用，不执行）",
      description:
        "仅提示潜在工具类别，所有工具维持 disabled-by-default。",
      status: "mock-only / disabled / preview-only",
    },
    {
      id: "step-confirm",
      name: "等待用户确认下一步",
      description:
        "dry-run 到此结束，不启动 Agent loop，不执行后续动作。",
      status: "mock-only / disabled / preview-only",
    },
  ];
}

function buildPresetDryRunSteps(
  presetId: PresetTaskId,
  taskText: string,
): DryRunStep[] {
  if (presetId === "explain-closure") {
    return [
      {
        id: "closure-step-input",
        name: "读取用户输入的概念问题（预览）",
        description: `仅在前端读取任务“${taskText}”的文本内容，不触发真实上下文读取。`,
        status: "mock-only / disabled / preview-only",
      },
      {
        id: "closure-step-split",
        name: "拆分关键概念：作用域、函数、变量生命周期（mock）",
        description: "只基于静态规则展示概念拆分，不调用模型推理。",
        status: "mock-only / disabled / preview-only",
      },
      {
        id: "closure-step-example",
        name: "规划示例代码说明（不真实执行）",
        description: "仅展示说明结构，不运行代码、不读取文件系统。",
        status: "mock-only / disabled / preview-only",
      },
      {
        id: "closure-step-draft",
        name: "生成解释草稿计划（不调用模型）",
        description: "只生成前端草稿步骤，不发起任何 LLM 请求。",
        status: "mock-only / disabled / preview-only",
      },
      {
        id: "closure-step-practice",
        name: "标记可能需要的练习题（工具禁用）",
        description: "仅标记练习方向，不执行工具、不读写数据库。",
        status: "mock-only / disabled / preview-only",
      },
      {
        id: "closure-step-confirm",
        name: "等待用户确认下一步",
        description: "dry-run 到此结束，不启动 Agent loop。",
        status: "mock-only / disabled / preview-only",
      },
    ];
  }

  if (presetId === "weekly-learning-plan") {
    return [
      {
        id: "week-step-goal",
        name: "识别学习目标（预览）",
        description: `仅在前端根据任务“${taskText}”展示目标识别占位，不读取真实学习记录。`,
        status: "mock-only / disabled / preview-only",
      },
      {
        id: "week-step-days",
        name: "拆分 7 天学习主题（mock）",
        description: "用静态模板展示 7 天主题拆分，不调用模型。",
        status: "mock-only / disabled / preview-only",
      },
      {
        id: "week-step-rhythm",
        name: "安排阅读、练习、复盘节奏（不写入数据库）",
        description: "仅展示节奏规划结果，不执行任何持久化写入。",
        status: "mock-only / disabled / preview-only",
      },
      {
        id: "week-step-draft",
        name: "生成每日任务草稿计划（不调用模型）",
        description: "只生成前端草稿，不发起真实 LLM 调用。",
        status: "mock-only / disabled / preview-only",
      },
      {
        id: "week-step-history",
        name: "标记需要参考的学习记录（仅预览）",
        description: "仅提示参考项，不读取数据库、不访问文件。",
        status: "mock-only / disabled / preview-only",
      },
      {
        id: "week-step-confirm",
        name: "等待用户确认下一步",
        description: "dry-run 到此结束，不启动 Agent loop。",
        status: "mock-only / disabled / preview-only",
      },
    ];
  }

  return [
    {
      id: "chapter-step-context",
      name: "读取当前章节上下文占位信息（预览，不真实读取）",
      description: `仅展示任务“${taskText}”的章节上下文占位，不读取真实章节数据。`,
      status: "mock-only / disabled / preview-only",
    },
    {
      id: "chapter-step-knowledge",
      name: "识别潜在知识点（mock）",
      description: "用静态规则展示知识点识别结果，不调用模型。",
      status: "mock-only / disabled / preview-only",
    },
    {
      id: "chapter-step-structure",
      name: "规划重点/难点/易错点结构（不调用模型）",
      description: "仅生成结构草案，不触发真实推理执行。",
      status: "mock-only / disabled / preview-only",
    },
    {
      id: "chapter-step-summary",
      name: "生成章节总结草稿计划（不真实生成）",
      description: "只在前端展示总结提纲，不输出真实模型结果。",
      status: "mock-only / disabled / preview-only",
    },
    {
      id: "chapter-step-notes",
      name: "标记可能关联的笔记和进度（不写数据库）",
      description: "仅做关联提示，不执行数据库写入。",
      status: "mock-only / disabled / preview-only",
    },
    {
      id: "chapter-step-confirm",
      name: "等待用户确认下一步",
      description: "dry-run 到此结束，不启动 Agent loop。",
      status: "mock-only / disabled / preview-only",
    },
  ];
}

function buildContextReferencePreview(
  presetId?: PresetTaskId,
): ContextReferenceCard[] {
  const baseCards: ContextReferenceCard[] = [
    {
      id: "context-current-chapter",
      name: "当前章节上下文",
      status: "mock-only",
      description:
        "仅展示未来可能读取当前章节，不真实读取正文。",
      isActuallyRead: false,
      writesToDatabase: false,
    },
    {
      id: "context-learning-progress",
      name: "用户学习进度",
      status: "preview-only",
      description:
        "仅展示未来可能参考进度，不查询数据库。",
      isActuallyRead: false,
      writesToDatabase: false,
    },
    {
      id: "context-notes-bookmarks",
      name: "历史笔记与书签",
      status: "disabled",
      description:
        "当前不读取真实笔记，不写入数据库。",
      isActuallyRead: false,
      writesToDatabase: false,
    },
    {
      id: "context-ability-profile",
      name: "能力画像",
      status: "mock-only",
      description:
        "仅展示未来可能参考能力分数，不执行真实推荐。",
      isActuallyRead: false,
      writesToDatabase: false,
    },
    {
      id: "context-tool-status",
      name: "工具状态",
      status: "disabled-by-default",
      description:
        "工具全部禁用，不执行文件、Shell、网络或数据库操作。",
      isActuallyRead: false,
      writesToDatabase: false,
    },
    {
      id: "context-provider-status",
      name: "Provider 状态",
      status: "mock provider only",
      description:
        "不调用真实模型，不读取密钥。",
      isActuallyRead: false,
      writesToDatabase: false,
    },
  ];

  if (presetId === "explain-closure") {
    return baseCards.map((card) => {
      if (card.id === "context-current-chapter") {
        return {
          ...card,
          description:
            "强调闭包相关章节、示例代码与概念拆解路径；仅预览，不真实读取。",
        };
      }

      if (card.id === "context-ability-profile") {
        return {
          ...card,
          description:
            "仅展示未来可能参考“概念理解深度”能力分数，不执行真实推荐。",
        };
      }

      return card;
    });
  }

  if (presetId === "weekly-learning-plan") {
    return baseCards.map((card) => {
      if (card.id === "context-learning-progress") {
        return {
          ...card,
          description:
            "强调周计划节奏与完成度占位信息；仅预览，不查询数据库。",
        };
      }

      if (card.id === "context-ability-profile") {
        return {
          ...card,
          description:
            "仅展示未来可能参考能力短板与难度分层，不执行真实推荐。",
        };
      }

      return card;
    });
  }

  if (presetId === "chapter-key-points") {
    return baseCards.map((card) => {
      if (card.id === "context-current-chapter") {
        return {
          ...card,
          description:
            "强调章节重点、难点与易错点占位信息；仅预览，不真实读取正文。",
        };
      }

      if (card.id === "context-notes-bookmarks") {
        return {
          ...card,
          description:
            "强调历史笔记与书签可能关联的易错点；当前 disabled，不读取不写入。",
        };
      }

      return card;
    });
  }

  return baseCards;
}

function buildPermissionAndRiskPreview(presetId?: PresetTaskId): {
  permissions: PermissionCheckPreviewItem[];
  risks: RiskConfirmationPreviewItem[];
} {
  const riskSuffix = "当前无真实风险触发，因为本轮只做 dry-run 预览。";
  const basePermissions: PermissionCheckPreviewItem[] = [
    {
      id: "permission-read-current-chapter",
      name: "读取当前章节上下文",
      status: "预览占位",
      isActuallyAuthorized: false,
      description: "本轮不真实读取章节正文。",
    },
    {
      id: "permission-read-history",
      name: "读取历史学习记录",
      status: "禁用",
      isActuallyAuthorized: false,
      description: "不查询数据库，不读取真实学习记录。",
    },
    {
      id: "permission-model-generate",
      name: "使用模型生成回答",
      status: "禁用",
      isActuallyAuthorized: false,
      description: "不调用真实 LLM，不读取 Provider 密钥。",
    },
    {
      id: "permission-run-tools",
      name: "执行工具",
      status: "禁用",
      isActuallyAuthorized: false,
      description: "不执行文件、Shell、网络、数据库工具。",
    },
    {
      id: "permission-write-progress",
      name: "写入学习进度",
      status: "禁用",
      isActuallyAuthorized: false,
      description: "不写数据库，不修改 localStorage 之外的数据。",
    },
    {
      id: "permission-save-raw",
      name: "保存 prompt/response",
      status: "禁用",
      isActuallyAuthorized: false,
      description: "不保存 raw prompt/raw response。",
    },
  ];

  const baseRisks: RiskConfirmationPreviewItem[] = [
    {
      id: "risk-model-call",
      name: "模型调用风险",
      status: "已禁用",
      description: `模型调用链路保持禁用。${riskSuffix}`,
    },
    {
      id: "risk-tool-execution",
      name: "工具执行风险",
      status: "已禁用",
      description: `工具执行链路保持禁用。${riskSuffix}`,
    },
    {
      id: "risk-data-write",
      name: "数据写入风险",
      status: "已禁用",
      description: `数据写入链路保持禁用。${riskSuffix}`,
    },
    {
      id: "risk-privacy",
      name: "隐私数据风险",
      status: "仅预览，不读取真实数据",
      description: `隐私数据仅做占位展示，不读取真实数据。${riskSuffix}`,
    },
    {
      id: "risk-agent-loop",
      name: "自动化执行风险",
      status: "Agent loop 未启用",
      description: `自动化执行链路未启用。${riskSuffix}`,
    },
  ];

  if (presetId === "explain-closure") {
    return {
      permissions: basePermissions.map((item) => {
        if (item.id === "permission-read-current-chapter") {
          return {
            ...item,
            description: "解释闭包仅展示预览路径，不会读取真实章节正文。",
          };
        }

        if (item.id === "permission-run-tools") {
          return {
            ...item,
            description: "不会运行示例代码，不执行任何工具。",
          };
        }

        return item;
      }),
      risks: baseRisks,
    };
  }

  if (presetId === "weekly-learning-plan") {
    return {
      permissions: basePermissions.map((item) => {
        if (item.id === "permission-read-history") {
          return {
            ...item,
            description: "不会读取真实能力分数或真实学习历史。",
          };
        }

        if (item.id === "permission-write-progress") {
          return {
            ...item,
            description: "不会写入一周计划，不会写入学习进度。",
          };
        }

        return item;
      }),
      risks: baseRisks,
    };
  }

  if (presetId === "chapter-key-points") {
    return {
      permissions: basePermissions.map((item) => {
        if (item.id === "permission-read-history") {
          return {
            ...item,
            description: "不会读取真实笔记或真实历史学习记录。",
          };
        }

        if (item.id === "permission-write-progress") {
          return {
            ...item,
            description: "不会写入章节总结，不会写入学习进度。",
          };
        }

        return item;
      }),
      risks: baseRisks,
    };
  }

  return {
    permissions: basePermissions,
    risks: baseRisks,
  };
}

function buildAnswerDraftStructure(
  presetId?: PresetTaskId,
): AnswerDraftSection[] {
  if (presetId === "explain-closure") {
    return [
      {
        id: "section-closure-definition",
        title: "概念定义",
        description: "先解释闭包是什么，以及它和函数、作用域的关系。",
      },
      {
        id: "section-closure-scope-example",
        title: "作用域示例",
        description: "用简短示例展示外层变量如何在函数返回后仍被访问。",
      },
      {
        id: "section-closure-mistakes",
        title: "常见误区",
        description: "列出闭包在循环、变量共享和内存理解上的常见误区。",
      },
      {
        id: "section-closure-practice",
        title: "练习建议",
        description: "给出 1-2 个可手动练习的方向，不触发真实执行。",
      },
    ];
  }

  if (presetId === "weekly-learning-plan") {
    return [
      {
        id: "section-weekly-goal-breakdown",
        title: "目标拆解",
        description: "把一周目标拆解为可执行的小目标和完成标准。",
      },
      {
        id: "section-weekly-7day-plan",
        title: "7 天安排",
        description: "给出每天主题与节奏的草稿化安排。",
      },
      {
        id: "section-weekly-daily-practice",
        title: "每日练习",
        description: "列出每日建议练习类型与预计投入时长。",
      },
      {
        id: "section-weekly-retro",
        title: "复盘建议",
        description: "给出周中和周末复盘的检查点与调整建议。",
      },
    ];
  }

  if (presetId === "chapter-key-points") {
    return [
      {
        id: "section-chapter-key-points",
        title: "章节重点",
        description: "提炼本章最关键的知识点和主线结构。",
      },
      {
        id: "section-chapter-difficult-points",
        title: "难点说明",
        description: "标注理解成本较高的部分及建议突破顺序。",
      },
      {
        id: "section-chapter-common-errors",
        title: "易错点",
        description: "列出高频混淆点与容易出错的场景。",
      },
      {
        id: "section-chapter-review-checklist",
        title: "复习清单",
        description: "整理回顾时可逐条自检的清单。",
      },
    ];
  }

  return [
    {
      id: "section-generic-objective",
      title: "任务目标",
      description: "先确认任务目标、输出范围与交付边界。",
    },
    {
      id: "section-generic-analysis",
      title: "关键信息分析",
      description: "梳理输入中的核心信息与待补充上下文。",
    },
    {
      id: "section-generic-main-answer",
      title: "回答正文结构",
      description: "按照先结论后展开的方式组织主体回答。",
    },
    {
      id: "section-generic-next-steps",
      title: "下一步建议",
      description: "给出后续可选动作与确认项（仅预览，不执行）。",
    },
  ];
}

function buildTaskUnderstanding(
  taskText: string,
  presetId?: PresetTaskId,
): string {
  if (presetId === "explain-closure") {
    return `用户希望理解“${taskText}”相关概念，重点是用可读示例解释作用域与闭包关系。`;
  }

  if (presetId === "weekly-learning-plan") {
    return `用户希望围绕“${taskText}”得到一份可执行的一周学习安排，重点是节奏与复盘。`;
  }

  if (presetId === "chapter-key-points") {
    return `用户希望基于“${taskText}”快速提炼重点、难点与复习线索。`;
  }

  return `基于用户输入“${taskText}”，当前仅模拟识别任务目标与回答方向，不进行真实推理执行。`;
}

function buildDryRunAnswerDraftPreview({
  taskText,
  steps,
  contextReferences,
  permissionChecks,
  riskConfirmations,
  presetId,
}: {
  taskText: string;
  steps: readonly DryRunStep[];
  contextReferences: readonly ContextReferenceCard[];
  permissionChecks: readonly PermissionCheckPreviewItem[];
  riskConfirmations: readonly RiskConfirmationPreviewItem[];
  presetId?: PresetTaskId;
}): DryRunAnswerDraftPreview {
  const stepSummary = steps.slice(0, 2).map((step) => step.name).join("、");
  const contextSummary = contextReferences
    .slice(0, 2)
    .map((card) => card.name)
    .join("、");

  return {
    title: "回答草稿（mock-only）",
    taskUnderstanding: buildTaskUnderstanding(taskText, presetId),
    planSummary: `本次 dry-run 共 ${steps.length} 个步骤；上下文引用预览 ${contextReferences.length} 项；权限检查 ${permissionChecks.length} 项；风险确认 ${riskConfirmations.length} 项。步骤摘要：${stepSummary || "无"}。上下文摘要：${contextSummary || "无"}。`,
    possibleAnswerStructure: buildAnswerDraftStructure(presetId),
    pendingConfirmationQuestions: [
      "是否继续下一步（仍保持 dry-run 预览）？",
      "后续是否允许接入真实模型（本轮不实现、默认不允许）？",
      "是否需要先调整任务范围再生成下一版草稿？",
    ],
    safetyStatement:
      "本草稿由前端 mock 状态生成，不调用模型，不执行工具，不写数据库。",
  };
}

function buildPresetExecutionConfirmationNote(presetId?: PresetTaskId): string {
  if (presetId === "explain-closure") {
    return "预设差异说明：不会运行示例代码，不会读取真实章节正文。";
  }

  if (presetId === "weekly-learning-plan") {
    return "预设差异说明：不会写入学习计划，不会修改用户进度。";
  }

  if (presetId === "chapter-key-points") {
    return "预设差异说明：不会读取真实笔记，不会保存章节总结。";
  }

  return "通用说明：本轮仅展示执行前确认预览，不触发真实执行。";
}

function buildDryRunExecutionConfirmationPreview({
  taskText,
  steps,
  contextReferences,
  riskConfirmations,
  presetId,
}: {
  taskText: string;
  steps: readonly DryRunStep[];
  contextReferences: readonly ContextReferenceCard[];
  riskConfirmations: readonly RiskConfirmationPreviewItem[];
  presetId?: PresetTaskId;
}): DryRunExecutionConfirmationPreview {
  return {
    presetSpecificNote: buildPresetExecutionConfirmationNote(presetId),
    items: [
      {
        id: "confirm-task-goal",
        name: "任务目标确认",
        summary: `当前 dry-run 任务：${taskText}`,
        status: "待用户确认",
        extraCheckLabel: "真实执行",
        extraCheckValue: "否",
        isActuallyExecuted: false,
        callsRealModel: false,
        writesToDatabase: false,
        requiresRealAuthorization: false,
      },
      {
        id: "confirm-plan-steps",
        name: "计划步骤确认",
        summary: `将参考当前 mock 步骤数量：${steps.length}`,
        status: "仅预览",
        extraCheckLabel: "真实执行",
        extraCheckValue: "否",
        isActuallyExecuted: false,
        callsRealModel: false,
        writesToDatabase: false,
        requiresRealAuthorization: false,
      },
      {
        id: "confirm-context-references",
        name: "上下文引用确认",
        summary: `将参考的 mock 上下文数量：${contextReferences.length}`,
        status: "未真实读取",
        extraCheckLabel: "真实读取",
        extraCheckValue: "否",
        isActuallyExecuted: false,
        callsRealModel: false,
        writesToDatabase: false,
        requiresRealAuthorization: false,
      },
      {
        id: "confirm-permission-risk",
        name: "权限与风险确认",
        summary: `风险标签数量：${riskConfirmations.length}`,
        status: "全部禁用 / mock-only",
        extraCheckLabel: "权限请求",
        extraCheckValue: "否",
        isActuallyExecuted: false,
        callsRealModel: false,
        writesToDatabase: false,
        requiresRealAuthorization: false,
      },
      {
        id: "confirm-answer-draft",
        name: "回答草稿确认",
        summary: "将生成 mock 草稿",
        status: "不调用模型",
        extraCheckLabel: "真实生成",
        extraCheckValue: "否",
        isActuallyExecuted: false,
        callsRealModel: false,
        writesToDatabase: false,
        requiresRealAuthorization: false,
      },
      {
        id: "confirm-execution-action",
        name: "执行动作确认",
        summary: "本轮不会执行",
        status: "Agent loop 未启用",
        extraCheckLabel: "执行工具",
        extraCheckValue: "否",
        isActuallyExecuted: false,
        callsRealModel: false,
        writesToDatabase: false,
        requiresRealAuthorization: false,
      },
    ],
  };
}

interface AgentTaskDryRunPanelProps {
  modeLabel: string;
}

export function AgentTaskDryRunPanel({ modeLabel }: AgentTaskDryRunPanelProps) {
  const [taskInput, setTaskInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentTask, setCurrentTask] = useState("");
  const [steps, setSteps] = useState<readonly DryRunStep[]>([]);
  const [contextReferences, setContextReferences] = useState<
    readonly ContextReferenceCard[]
  >([]);
  const [permissionChecks, setPermissionChecks] = useState<
    readonly PermissionCheckPreviewItem[]
  >([]);
  const [riskConfirmations, setRiskConfirmations] = useState<
    readonly RiskConfirmationPreviewItem[]
  >([]);
  const [answerDraftPreview, setAnswerDraftPreview] =
    useState<DryRunAnswerDraftPreview | null>(null);
  const [executionConfirmationPreview, setExecutionConfirmationPreview] =
    useState<DryRunExecutionConfirmationPreview | null>(null);
  const [isDryRunPreviewConfirmed, setIsDryRunPreviewConfirmed] =
    useState(false);

  const trimmedTaskInput = taskInput.trim();
  const canGenerate = trimmedTaskInput.length > 0 && !isLoading;
  const hasPlan = steps.length > 0;
  const hasContextReferences = contextReferences.length > 0;
  const hasPermissionChecks = permissionChecks.length > 0;
  const hasRiskConfirmations = riskConfirmations.length > 0;
  const hasAnswerDraftPreview = answerDraftPreview !== null;
  const hasExecutionConfirmationPreview = executionConfirmationPreview !== null;

  const handleGenerateDryRunPlan = async () => {
    if (trimmedTaskInput.length === 0 || isLoading) {
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => {
      setTimeout(resolve, 480);
    });
    const nextSteps = buildDefaultDryRunSteps(trimmedTaskInput);
    const nextContextReferences = buildContextReferencePreview();
    const { permissions, risks } = buildPermissionAndRiskPreview();
    const nextAnswerDraftPreview = buildDryRunAnswerDraftPreview({
      taskText: trimmedTaskInput,
      steps: nextSteps,
      contextReferences: nextContextReferences,
      permissionChecks: permissions,
      riskConfirmations: risks,
    });
    const nextExecutionConfirmationPreview =
      buildDryRunExecutionConfirmationPreview({
        taskText: trimmedTaskInput,
        steps: nextSteps,
        contextReferences: nextContextReferences,
        riskConfirmations: risks,
      });

    setCurrentTask(trimmedTaskInput);
    setSteps(nextSteps);
    setContextReferences(nextContextReferences);
    setPermissionChecks(permissions);
    setRiskConfirmations(risks);
    setAnswerDraftPreview(nextAnswerDraftPreview);
    setExecutionConfirmationPreview(nextExecutionConfirmationPreview);
    setIsDryRunPreviewConfirmed(false);
    setIsLoading(false);
  };

  const handleApplyPresetTask = (presetTask: PresetTask) => {
    if (isLoading) {
      return;
    }

    const nextSteps = buildPresetDryRunSteps(presetTask.id, presetTask.taskText);
    const nextContextReferences = buildContextReferencePreview(presetTask.id);
    const { permissions, risks } = buildPermissionAndRiskPreview(presetTask.id);
    const nextAnswerDraftPreview = buildDryRunAnswerDraftPreview({
      taskText: presetTask.taskText,
      steps: nextSteps,
      contextReferences: nextContextReferences,
      permissionChecks: permissions,
      riskConfirmations: risks,
      presetId: presetTask.id,
    });
    const nextExecutionConfirmationPreview =
      buildDryRunExecutionConfirmationPreview({
        taskText: presetTask.taskText,
        steps: nextSteps,
        contextReferences: nextContextReferences,
        riskConfirmations: risks,
        presetId: presetTask.id,
      });

    setTaskInput(presetTask.taskText);
    setCurrentTask(presetTask.taskText);
    setSteps(nextSteps);
    setContextReferences(nextContextReferences);
    setPermissionChecks(permissions);
    setRiskConfirmations(risks);
    setAnswerDraftPreview(nextAnswerDraftPreview);
    setExecutionConfirmationPreview(nextExecutionConfirmationPreview);
    setIsDryRunPreviewConfirmed(false);
  };

  const handleClearPlan = () => {
    setTaskInput("");
    setCurrentTask("");
    setSteps([]);
    setContextReferences([]);
    setPermissionChecks([]);
    setRiskConfirmations([]);
    setAnswerDraftPreview(null);
    setExecutionConfirmationPreview(null);
    setIsDryRunPreviewConfirmed(false);
    setIsLoading(false);
  };

  const handleConfirmDryRunPreview = () => {
    if (isLoading || !hasExecutionConfirmationPreview) {
      return;
    }

    setIsDryRunPreviewConfirmed(true);
  };

  const handleUndoConfirmDryRunPreview = () => {
    if (isLoading || !hasExecutionConfirmationPreview) {
      return;
    }

    setIsDryRunPreviewConfirmed(false);
  };

  return (
    <section className={styles.section} aria-labelledby="agent-task-dry-run">
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle} id="agent-task-dry-run">
            任务计划 dry-run 预览
          </h2>
          <p className={styles.sectionNote}>
            开发预览功能：仅在前端生成 mock 计划步骤，不会真实执行任务。
          </p>
        </div>
      </div>

      <div className={styles.taskLayout}>
        <div className={styles.inputPreview}>
          <div className={styles.taskForm}>
            <label className={styles.taskLabel} htmlFor="agent-dry-run-task">
              任务文本（开发预览 / dry-run）
            </label>
            <textarea
              aria-describedby="agent-dry-run-task-help"
              className={styles.taskTextarea}
              id="agent-dry-run-task"
              onChange={(event) => {
                setTaskInput(event.target.value);
              }}
              placeholder="示例：帮我总结当前章节的重点"
              rows={5}
              value={taskInput}
            />
            <article
              className={styles.planPreviewCard}
              aria-label="dry-run 预设任务示例"
            >
              <div className={styles.planHeader}>
                <div>
                  <h3 className={styles.planTitle}>预设任务示例（快速体验）</h3>
                  <p className={styles.planSummary}>
                    点击任一预设会自动填充任务输入，并立即生成 mock-only dry-run
                    步骤。
                  </p>
                </div>
              </div>
              <div className={styles.taskActions}>
                {presetTasks.map((presetTask) => (
                  <button
                    className={styles.secondaryButton}
                    key={presetTask.id}
                    onClick={() => {
                      handleApplyPresetTask(presetTask);
                    }}
                    type="button"
                  >
                    {presetTask.title}
                  </button>
                ))}
              </div>
              <ul className={styles.safetyNotes}>
                <li>预设只用于快速体验 dry-run。</li>
                <li>不调用真实模型。</li>
                <li>不执行工具。</li>
                <li>不读取文件系统。</li>
                <li>不写数据库。</li>
                <li>不保存 raw prompt/raw response。</li>
              </ul>
            </article>
            <div className={styles.taskActions}>
              <button
                className={styles.previewButton}
                disabled={!canGenerate}
                onClick={handleGenerateDryRunPlan}
                type="button"
              >
                {isLoading ? "生成中..." : "生成 dry-run 计划"}
              </button>
              <button
                className={styles.secondaryButton}
                onClick={handleClearPlan}
                type="button"
              >
                清空计划
              </button>
            </div>
            <p className={styles.disabledCopy} id="agent-dry-run-task-help">
              当前 URL 模式：{modeLabel}。即使为 runtime 参数，本区域仍为
              mock-only/preview-only。
            </p>
            {trimmedTaskInput.length === 0 ? (
              <p className={styles.disabledReason}>
                请输入任务文本后再生成 dry-run 计划。
              </p>
            ) : null}
          </div>
        </div>

        <aside className={styles.dryRunResultPanel} aria-label="dry-run 计划结果">
          <div className={styles.planHeader}>
            <div>
              <h3 className={styles.planTitle}>dry-run 计划结果（mock-only）</h3>
              <p className={styles.planSummary}>
                仅用于展示未来 Agent 可能的任务规划方式，不代表真实可执行能力。
              </p>
            </div>
          </div>

          {isLoading ? (
            <p className={styles.disabledReason}>
              正在生成前端 dry-run 计划（无网络请求）...
            </p>
          ) : null}

          {!isLoading && hasPlan ? (
            <>
              <p className={styles.disabledReason}>当前 dry-run 任务：{currentTask}</p>
              <ol className={styles.stepList}>
                {steps.map((step) => (
                  <li className={styles.stepItem} key={step.id}>
                    <p className={styles.stepTitle}>{step.name}</p>
                    <p className={styles.stepDescription}>{step.description}</p>
                    <div className={styles.stepFacts}>
                      <span>状态：{step.status}</span>
                      <span>是否会真实执行：否</span>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          ) : null}

          {!isLoading && !hasPlan ? (
            <p className={styles.disabledReason}>
              尚未生成 dry-run 计划。该区域只展示 mock 步骤，不触发真实执行。
            </p>
          ) : null}

          <section
            className={styles.planBlock}
            aria-labelledby="dry-run-context-reference-preview"
          >
            <h4 className={styles.detailTitle} id="dry-run-context-reference-preview">
              上下文引用预览（dry-run）
            </h4>
            <p className={styles.disabledReason}>
              以下上下文仅为 dry-run 预览，不代表系统已经读取这些数据；本轮不会调用模型、不会执行工具、不会写数据库。
            </p>
            {!isLoading && !hasContextReferences ? (
              <p className={styles.emptyList}>
                生成 dry-run 计划后，将在这里展示本次预览会参考的 mock 上下文。
              </p>
            ) : null}
            {!isLoading && hasContextReferences ? (
              <ol className={styles.stepList}>
                {contextReferences.map((card) => (
                  <li className={styles.stepItem} key={card.id}>
                    <p className={styles.stepTitle}>{card.name}</p>
                    <p className={styles.stepDescription}>{card.description}</p>
                    <div className={styles.stepFacts}>
                      <span>状态：{card.status}</span>
                      <span>preview-only</span>
                      <span>mock-only</span>
                      <span>
                        是否真实读取：{card.isActuallyRead ? "是" : "否（未真实读取）"}
                      </span>
                      <span>
                        是否写入数据库：
                        {card.writesToDatabase ? "是" : "否（未写入数据库）"}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>

          <section
            className={styles.planBlock}
            aria-labelledby="dry-run-permission-risk-preview"
          >
            <h4 className={styles.detailTitle} id="dry-run-permission-risk-preview">
              权限检查与风险确认（dry-run）
            </h4>
            {!isLoading && !hasPermissionChecks && !hasRiskConfirmations ? (
              <p className={styles.emptyList}>
                生成 dry-run 计划后，将在这里展示本次预览可能涉及的权限和风险确认项。
              </p>
            ) : null}
            {!isLoading && hasPermissionChecks ? (
              <>
                <p className={styles.detailSubheading}>权限项（mock-only）</p>
                <ol className={styles.stepList}>
                  {permissionChecks.map((item) => (
                    <li className={styles.stepItem} key={item.id}>
                      <p className={styles.stepTitle}>{item.name}</p>
                      <p className={styles.stepDescription}>{item.description}</p>
                      <div className={styles.stepFacts}>
                        <span>权限状态：{item.status}</span>
                        <span>
                          是否真实授权：
                          {item.isActuallyAuthorized
                            ? "是"
                            : "否（未真实授权）"}
                        </span>
                        <span>preview-only</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
            {!isLoading && hasRiskConfirmations ? (
              <>
                <p className={styles.detailSubheading}>风险标签（mock-only）</p>
                <ol className={styles.stepList}>
                  {riskConfirmations.map((item) => (
                    <li className={styles.stepItem} key={item.id}>
                      <p className={styles.stepTitle}>{item.name}</p>
                      <p className={styles.stepDescription}>{item.description}</p>
                      <div className={styles.stepFacts}>
                        <span>风险状态：{item.status}</span>
                        <span>当前无真实风险触发</span>
                        <span>dry-run 预览</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </>
            ) : null}
            <p className={styles.disabledReason}>
              以上权限与风险仅为 dry-run 预览，不代表系统已经请求权限、读取数据或执行操作。本轮不会调用模型、不会执行工具、不会写数据库、不会保存 raw prompt/raw response。
            </p>
          </section>

          <section
            className={styles.planBlock}
            aria-labelledby="dry-run-answer-draft-preview"
          >
            <h4 className={styles.detailTitle} id="dry-run-answer-draft-preview">
              回答草稿预览（dry-run）
            </h4>
            {!isLoading && !hasAnswerDraftPreview ? (
              <p className={styles.emptyList}>
                生成 dry-run 计划后，将在这里展示 mock 回答草稿。本区域不会调用真实模型。
              </p>
            ) : null}
            {!isLoading && hasAnswerDraftPreview && answerDraftPreview !== null ? (
              <article className={styles.stepItem} aria-label="mock-only 回答草稿">
                <p className={styles.stepTitle}>{answerDraftPreview.title}</p>
                <div className={styles.planBlock}>
                  <p className={styles.detailSubheading}>任务理解</p>
                  <p className={styles.stepDescription}>
                    {answerDraftPreview.taskUnderstanding}
                  </p>
                </div>
                <div className={styles.planBlock}>
                  <p className={styles.detailSubheading}>计划摘要</p>
                  <p className={styles.stepDescription}>
                    {answerDraftPreview.planSummary}
                  </p>
                </div>
                <div className={styles.planBlock}>
                  <p className={styles.detailSubheading}>可能的回答结构</p>
                  <ol className={styles.stepList}>
                    {answerDraftPreview.possibleAnswerStructure.map((section) => (
                      <li className={styles.stepItem} key={section.id}>
                        <p className={styles.stepTitle}>{section.title}</p>
                        <p className={styles.stepDescription}>
                          {section.description}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className={styles.planBlock}>
                  <p className={styles.detailSubheading}>待用户确认的问题</p>
                  <ul className={styles.safetyNotes}>
                    {answerDraftPreview.pendingConfirmationQuestions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className={styles.planBlock}>
                  <p className={styles.detailSubheading}>安全声明</p>
                  <p className={styles.disabledReason}>
                    {answerDraftPreview.safetyStatement}
                  </p>
                </div>
              </article>
            ) : null}
            <p className={styles.disabledReason}>
              以上回答草稿仅为 dry-run 预览，由前端 mock 状态生成；本轮不会调用模型、不会执行工具、不会写数据库、不会保存 raw prompt/raw response。当前 URL 模式：{modeLabel}，本区仍为 mock dry-run，不代表 runtime 已启用。
            </p>
          </section>
          <section
            className={styles.planBlock}
            aria-labelledby="dry-run-execution-confirmation-preview"
          >
            <h4
              className={styles.detailTitle}
              id="dry-run-execution-confirmation-preview"
            >
              执行前确认（dry-run）
            </h4>
            {!isLoading && !hasExecutionConfirmationPreview ? (
              <p className={styles.emptyList}>
                生成 dry-run 计划后，将在这里展示执行前确认清单。本区域不会触发真实执行。
              </p>
            ) : null}
            {!isLoading &&
            hasExecutionConfirmationPreview &&
            executionConfirmationPreview !== null ? (
              <>
                <p className={styles.stepDescription}>
                  {executionConfirmationPreview.presetSpecificNote}
                </p>
                <ol className={styles.stepList}>
                  {executionConfirmationPreview.items.map((item) => (
                    <li className={styles.stepItem} key={item.id}>
                      <p className={styles.stepTitle}>{item.name}</p>
                      <p className={styles.stepDescription}>{item.summary}</p>
                      <div className={styles.stepFacts}>
                        <span>状态：{item.status}</span>
                        <span>
                          {item.extraCheckLabel}：{item.extraCheckValue}
                        </span>
                        <span>
                          是否真实执行：
                          {item.isActuallyExecuted ? "是" : "否"}
                        </span>
                        <span>
                          是否调用模型：
                          {item.callsRealModel ? "是" : "否"}
                        </span>
                        <span>
                          是否写入数据库：
                          {item.writesToDatabase ? "是" : "否"}
                        </span>
                        <span>
                          是否需要用户真实授权：
                          {item.requiresRealAuthorization ? "是" : "否，本轮仅预览"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className={styles.taskActions}>
                  <button
                    className={styles.previewButton}
                    disabled={isLoading}
                    onClick={handleConfirmDryRunPreview}
                    type="button"
                  >
                    确认 dry-run 预览
                  </button>
                  <button
                    className={styles.secondaryButton}
                    disabled={isLoading}
                    onClick={handleUndoConfirmDryRunPreview}
                    type="button"
                  >
                    撤销确认
                  </button>
                </div>
                <p className={styles.detailSubheading}>
                  {isDryRunPreviewConfirmed
                    ? "已确认 dry-run 预览：未触发真实执行"
                    : "当前未确认 dry-run 预览"}
                </p>
              </>
            ) : null}
            <p className={styles.disabledReason}>
              以上确认仅用于 dry-run
              预览，不代表系统已经获得权限或即将执行。本轮不会调用模型、不会执行工具、不会写数据库、不会保存
              raw prompt/raw response。当前 URL 模式：{modeLabel}，本区仍为 mock
              dry-run，不代表 runtime 已启用。
            </p>
          </section>
        </aside>
      </div>

      <article className={styles.planPreviewCard} aria-label="dry-run 安全提示">
        <div className={styles.planHeader}>
          <div>
            <h3 className={styles.planTitle}>dry-run 安全提示（开发预览）</h3>
          </div>
        </div>
        <ul className={styles.safetyNotes}>
          <li>本功能只生成前端 mock 任务计划。</li>
          <li>不调用真实模型。</li>
          <li>不执行工具。</li>
          <li>不读取文件系统。</li>
          <li>不写数据库。</li>
          <li>不保存 raw prompt/raw response。</li>
          <li>后续若接入真实 Agent loop，需要单独权限与审计。</li>
        </ul>
      </article>
    </section>
  );
}
