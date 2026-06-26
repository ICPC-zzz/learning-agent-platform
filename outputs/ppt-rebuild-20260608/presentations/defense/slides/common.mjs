const C = {
  navy: "#16324F",
  navy2: "#244B70",
  blue: "#2E6F95",
  cyan: "#48A9A6",
  amber: "#D68A2F",
  paper: "#F5F7FA",
  white: "#FFFFFF",
  ink: "#182536",
  muted: "#586A7E",
  border: "#CCD8E5",
  paleBlue: "#EAF2F8",
  paleCyan: "#E8F5F3",
  paleAmber: "#FCF1E3",
  green: "#3D806F",
};

const FONT = "Microsoft YaHei";
const ROOT = "E:\\code\\learning-agent-platform";
const ASSET = `${ROOT}\\outputs\\demo-captures`;

function rect(ctx, slide, x, y, w, h, fill, line = C.border, width = 1, geometry = "rect", name) {
  return ctx.addShape(slide, {
    x, y, w, h, geometry, fill,
    line: ctx.line(line, width),
    name,
  });
}

function text(ctx, slide, value, x, y, w, h, size = 32, color = C.ink, bold = false, align = "left", valign = "top", fill = "#00000000", name) {
  return ctx.addText(slide, {
    text: value,
    x, y, w, h,
    fontSize: size,
    color,
    bold,
    typeface: FONT,
    align,
    valign,
    fill,
    line: ctx.line("#00000000", 0),
    insets: { left: 0, right: 0, top: 0, bottom: 0 },
    name,
  });
}

function header(ctx, slide, title, kicker, page) {
  rect(ctx, slide, 0, 0, 1280, 82, C.navy, C.navy, 0, "rect", `header-${page}`);
  rect(ctx, slide, 0, 82, 1280, 5, C.amber, C.amber, 0);
  text(ctx, slide, kicker, 64, 17, 220, 24, 20, "#BFD3E5", true, "left", "middle", "#00000000", `kicker-${page}`);
  text(ctx, slide, title, 64, 38, 930, 42, 46, C.white, true, "left", "middle", "#00000000", `title-${page}`);
  text(ctx, slide, `${String(page).padStart(2, "0")} / 12`, 1160, 650, 72, 24, 18, C.muted, false, "right", "middle");
  text(ctx, slide, "MVP · PREVIEW ONLY", 1040, 24, 176, 28, 18, C.white, true, "center", "middle", C.navy2);
}

function bullet(ctx, slide, value, x, y, w, h = 60, accent = C.blue, size = 32) {
  rect(ctx, slide, x, y + 13, 10, 10, accent, accent, 0, "ellipse");
  text(ctx, slide, value, x + 24, y, w - 24, h, size, C.ink, false, "left", "top");
}

function label(ctx, slide, value, x, y, w, color = C.blue) {
  text(ctx, slide, value, x, y, w, 34, 24, color, true, "left", "middle");
}

function panel(ctx, slide, x, y, w, h, fill = C.white, name) {
  return rect(ctx, slide, x, y, w, h, fill, C.border, 1, "roundRect", name);
}

function node(ctx, slide, n, titleValue, note, x, y, w, accent) {
  panel(ctx, slide, x, y, w, 150, C.white);
  rect(ctx, slide, x + (w - 46) / 2, y + 12, 46, 46, accent, accent, 0, "ellipse");
  text(ctx, slide, String(n), x + (w - 46) / 2, y + 14, 46, 38, 26, C.white, true, "center", "middle");
  text(ctx, slide, titleValue, x + 12, y + 66, w - 24, 38, 28, C.ink, true, "center", "middle");
  text(ctx, slide, note, x + 12, y + 108, w - 24, 30, 24, C.muted, false, "center", "middle");
}

async function screenshot(ctx, slide, filename, x, y, w, h) {
  panel(ctx, slide, x - 8, y - 8, w + 16, h + 16, C.white);
  return ctx.addImage(slide, {
    path: `${ASSET}\\${filename}`,
    x, y, w, h,
    fit: "cover",
    alt: filename,
  });
}

function screenshotRail(ctx, slide, titleValue, bullets, status, page) {
  header(ctx, slide, titleValue, "成果展示", page);
  panel(ctx, slide, 836, 126, 380, 470, C.white);
  label(ctx, slide, "核心能力", 872, 160, 300);
  bullets.forEach((item, index) => bullet(ctx, slide, item, 872, 220 + index * 92, 300, 76, index === bullets.length - 1 ? C.amber : C.blue, 30));
  rect(ctx, slide, 836, 616, 300, 54, C.paleCyan, C.paleCyan, 0, "roundRect");
  text(ctx, slide, status, 852, 628, 268, 32, 24, C.green, true, "center", "middle");
}

function arrow(ctx, slide, x, y, w = 44) {
  text(ctx, slide, "→", x, y, w, 48, 38, C.border, true, "center", "middle");
}

export async function renderSlide01(presentation, ctx) {
  const slide = presentation.slides.add();
  rect(ctx, slide, 0, 0, 1280, 720, C.navy, C.navy, 0);
  rect(ctx, slide, 0, 0, 18, 720, C.amber, C.amber, 0);
  text(ctx, slide, "课程项目答辩", 70, 66, 420, 36, 24, "#BFD3E5", true);
  text(ctx, slide, "AI 编程学习平台", 70, 132, 620, 76, 64, C.white, true);
  text(ctx, slide, "Learning Agent Platform", 72, 222, 590, 46, 34, "#D8E6F2", false);
  text(ctx, slide, "编程学习网站 · Reader · 导入预览 · Desktop · AI Agent 规划", 72, 300, 592, 96, 30, C.white, false);
  rect(ctx, slide, 70, 438, 590, 2, C.amber, C.amber, 0);
  text(ctx, slide, "组号：________", 72, 470, 260, 42, 32, C.white, false, "left", "middle", "#00000000", "group-number");
  text(ctx, slide, "课程名称：________________", 338, 470, 330, 42, 32, C.white, false, "left", "middle", "#00000000", "course-name");
  text(ctx, slide, "日期：____年__月__日", 72, 530, 390, 42, 32, C.white, false, "left", "middle", "#00000000", "defense-date");
  panel(ctx, slide, 720, 68, 500, 584, C.white, "member-panel");
  text(ctx, slide, "小组成员", 764, 104, 410, 52, 40, C.navy, true);
  rect(ctx, slide, 764, 168, 410, 2, C.border, C.border, 0);
  text(ctx, slide, "序号", 764, 180, 52, 34, 24, C.muted, true, "center", "middle");
  text(ctx, slide, "姓名", 824, 180, 150, 34, 24, C.muted, true, "center", "middle");
  text(ctx, slide, "学号", 982, 180, 192, 34, 24, C.muted, true, "center", "middle");
  for (let i = 0; i < 5; i += 1) {
    const y = 224 + i * 72;
    text(ctx, slide, String(i + 1), 764, y, 52, 40, 28, C.ink, false, "center", "middle");
    text(ctx, slide, "________", 824, y, 150, 40, 28, C.ink, false, "center", "middle", "#00000000", `member-name-${i + 1}`);
    text(ctx, slide, "____________", 982, y, 192, 40, 28, C.ink, false, "center", "middle", "#00000000", `member-id-${i + 1}`);
    rect(ctx, slide, 764, y + 48, 410, 1, C.border, C.border, 0);
  }
  return slide;
}

export async function renderSlide02(presentation, ctx) {
  const slide = presentation.slides.add();
  rect(ctx, slide, 0, 0, 1280, 720, C.paper, C.paper, 0);
  header(ctx, slide, "小组分工", "团队协作", 2);
  const x = [64, 220, 390, 1034, 1216];
  const headers = ["姓名", "学号", "具体负责工作", "组内评分"];
  headers.forEach((h, i) => {
    rect(ctx, slide, x[i], 126, x[i + 1] - x[i], 58, C.navy2, C.white, 1);
    text(ctx, slide, h, x[i] + 8, 136, x[i + 1] - x[i] - 16, 38, 28, C.white, true, "center", "middle");
  });
  const jobs = [
    "项目创意设计、需求分析、答辩讲解",
    "AI 工具选型、Codex 协作、代码生成",
    "Web 页面测试、导入预览功能验收",
    "演示视频录制、字幕说明、素材整理",
    "PPT 制作、项目总结、答辩材料整理",
  ];
  for (let r = 0; r < 5; r += 1) {
    const y = 184 + r * 88;
    const values = ["________", "____________", jobs[r], "________"];
    values.forEach((value, i) => {
      rect(ctx, slide, x[i], y, x[i + 1] - x[i], 88, r % 2 === 0 ? C.white : "#F8FAFC", C.border, 1);
      text(ctx, slide, value, x[i] + 10, y + 14, x[i + 1] - x[i] - 20, 60, i === 2 ? 30 : 32, C.ink, false, i === 2 ? "left" : "center", "middle", "#00000000", `team-${r + 1}-${i + 1}`);
    });
  }
  return slide;
}

export async function renderSlide03(presentation, ctx) {
  const slide = presentation.slides.add();
  rect(ctx, slide, 0, 0, 1280, 720, C.paper, C.paper, 0);
  header(ctx, slide, "学习资料分散，学习闭环难形成", "项目背景", 3);
  const items = [
    ["01", "资料分散", "书籍、代码、练习与总结分布在不同工具中。", C.blue],
    ["02", "行动断层", "初学者读完内容后，常常不知道下一步练什么。", C.cyan],
    ["03", "AI 新机会", "AI 可辅助理解代码，并规划更清晰的学习路径。", C.amber],
  ];
  items.forEach(([num, titleValue, body, color], i) => {
    const x = 64 + i * 404;
    panel(ctx, slide, x, 148, 360, 410, C.white);
    text(ctx, slide, num, x + 28, 176, 90, 56, 48, color, true);
    rect(ctx, slide, x + 28, 250, 304, 3, color, color, 0);
    text(ctx, slide, titleValue, x + 28, 282, 304, 52, 38, C.navy, true);
    text(ctx, slide, body, x + 28, 360, 304, 130, 32, C.ink, false);
  });
  text(ctx, slide, "目标用户：编程初学者与需要结构化阅读、练习和复盘的学习者", 64, 602, 1152, 46, 30, C.navy2, true, "center", "middle", C.paleBlue);
  return slide;
}

export async function renderSlide04(presentation, ctx) {
  const slide = presentation.slides.add();
  rect(ctx, slide, 0, 0, 1280, 720, C.paper, C.paper, 0);
  header(ctx, slide, "把阅读、整理和学习行动连成一条链路", "核心创意", 4);
  const nodes = [
    ["学习网站", "内容入口"],
    ["Reader", "代码阅读"],
    ["导入预览", "章节整理"],
    ["Desktop", "本地状态"],
    ["AI Agent", "路径规划"],
  ];
  nodes.forEach(([name, note], i) => {
    const x = 54 + i * 244;
    panel(ctx, slide, x, 166, 196, 142, i === 4 ? C.paleAmber : C.white);
    text(ctx, slide, name, x + 12, 194, 172, 42, 30, C.navy, true, "center", "middle");
    text(ctx, slide, note, x + 12, 248, 172, 34, 24, C.muted, false, "center", "middle");
    if (i < 4) arrow(ctx, slide, x + 198, 210, 46);
  });
  const outcomes = [
    ["阅读效率", "快速定位代码块与章节内容"],
    ["内容整理", "导入前预览、重命名和排除章节"],
    ["AI 协作", "辅助开发、测试和材料制作"],
  ];
  outcomes.forEach(([name, desc], i) => {
    const x = 64 + i * 404;
    rect(ctx, slide, x, 388, 360, 188, i === 1 ? C.paleCyan : C.paleBlue, C.border, 1, "roundRect");
    text(ctx, slide, name, x + 28, 420, 304, 40, 30, C.blue, true);
    text(ctx, slide, desc, x + 28, 482, 304, 76, 28, C.ink, false);
  });
  text(ctx, slide, "创新点不是单一 AI 功能，而是让学习流程在安全边界内逐步连通。", 64, 608, 1152, 44, 30, C.navy, true, "center", "middle");
  return slide;
}

export async function renderSlide05(presentation, ctx) {
  const slide = presentation.slides.add();
  rect(ctx, slide, 0, 0, 1280, 720, C.paper, C.paper, 0);
  header(ctx, slide, "不同 AI 工具承担不同的开发协作任务", "工具选择", 5);
  const tools = [
    ["ChatGPT / GPT-5.5", "需求拆解、方案设计、答辩材料规划", C.blue],
    ["Codex / GPT-5.4 mini", "代码生成、测试修复、功能迭代", C.cyan],
    ["Claude Code", "辅助代码审查、局部执行与提交整理", C.amber],
    ["DeepSeek 文档 Agent", "阶段总结、上下文压缩与 handoff", C.green],
  ];
  tools.forEach(([name, desc, color], i) => {
    const x = i % 2 === 0 ? 64 : 658;
    const y = i < 2 ? 140 : 374;
    panel(ctx, slide, x, y, 558, 194, C.white);
    rect(ctx, slide, x, y, 12, 194, color, color, 0);
    text(ctx, slide, name, x + 40, y + 30, 478, 48, 34, C.navy, true);
    text(ctx, slide, desc, x + 40, y + 98, 478, 72, 30, C.ink, false);
  });
  text(ctx, slide, "以上工具用于开发协作，不代表当前系统已经接入生产级 AI 能力。", 64, 606, 1152, 44, 28, C.muted, true, "center", "middle", C.paleAmber);
  return slide;
}

export async function renderSlide06(presentation, ctx) {
  const slide = presentation.slides.add();
  rect(ctx, slide, 0, 0, 1280, 720, C.paper, C.paper, 0);
  header(ctx, slide, "AI 协作采用小步迭代和人工验收闭环", "运用流程", 6);
  const steps = [
    ["明确目标", "人工提出需求", C.blue],
    ["方案拆解", "ChatGPT", C.amber],
    ["代码实现", "Codex", C.cyan],
    ["测试验收", "人工检查", C.green],
    ["handoff", "DeepSeek", C.navy2],
  ];
  steps.forEach(([name, note, color], i) => {
    const x = 48 + i * 246;
    node(ctx, slide, i + 1, name, note, x, 196, 198, color);
    if (i < 4) arrow(ctx, slide, x + 198, 246, 48);
  });
  panel(ctx, slide, 90, 430, 1100, 150, C.white);
  bullet(ctx, slide, "每轮只处理一个明确目标，控制任务范围。", 132, 448, 1000, 38, C.blue, 28);
  bullet(ctx, slide, "代码修改后运行测试，再由人工确认结果。", 132, 494, 1000, 38, C.cyan, 28);
  bullet(ctx, slide, "handoff 保存阶段结论，减少长上下文带来的偏差。", 132, 540, 1000, 38, C.amber, 28);
  return slide;
}

export async function renderSlide07(presentation, ctx) {
  const slide = presentation.slides.add();
  rect(ctx, slide, 0, 0, 1280, 720, C.paper, C.paper, 0);
  header(ctx, slide, "AI 提高开发效率，关键决策仍由人负责", "核心作用", 7);
  panel(ctx, slide, 64, 132, 720, 478, C.white);
  label(ctx, slide, "AI 主要贡献", 100, 166, 620);
  const points = [
    "生成 Next.js、TypeScript 与 Electron 代码",
    "设计 preview-only 安全边界",
    "生成测试用例并修复类型错误",
    "生成演示脚本与 PPT 初稿",
    "总结项目进度与风险",
  ];
  points.forEach((p, i) => bullet(ctx, slide, p, 100, 226 + i * 70, 640, 54, i === 1 ? C.amber : C.blue, 30));
  rect(ctx, slide, 824, 132, 392, 478, C.navy, C.navy, 0, "roundRect");
  text(ctx, slide, "人工把关", 868, 174, 304, 50, 40, C.white, true, "center", "middle");
  const human = ["功能是否符合需求", "数据与权限是否安全", "结果是否通过测试"];
  human.forEach((p, i) => {
    rect(ctx, slide, 870, 264 + i * 92, 52, 52, i === 1 ? C.amber : C.cyan, i === 1 ? C.amber : C.cyan, 0, "ellipse");
    text(ctx, slide, "✓", 870, 270 + i * 92, 52, 40, 28, C.white, true, "center", "middle");
    text(ctx, slide, p, 944, 264 + i * 92, 218, 52, 28, C.white, false, "left", "middle");
  });
  text(ctx, slide, "AI 是协作工具，不替代人工验收、安全审查和边界控制。", 64, 632, 1152, 42, 28, C.navy, true, "center", "middle", C.paleBlue);
  return slide;
}

export async function renderSlide08(presentation, ctx) {
  const slide = presentation.slides.add();
  rect(ctx, slide, 0, 0, 1280, 720, C.paper, C.paper, 0);
  header(ctx, slide, "用明确约束解决 AI 协作中的常见问题", "问题与解决", 8);
  const x = [82, 520, 1198];
  ["问题", "解决方法"].forEach((h, i) => {
    rect(ctx, slide, x[i], 132, x[i + 1] - x[i], 58, C.navy2, C.white, 1);
    text(ctx, slide, h, x[i], 142, x[i + 1] - x[i], 38, 30, C.white, true, "center", "middle");
  });
  const rows = [
    ["上下文过长", "使用 handoff 文档进行阶段压缩"],
    ["AI 扩大任务范围", "每轮明确允许目录与禁止事项"],
    ["数据与执行风险", "preview-only、disabled-by-default、不写 DB"],
    ["PPT 文字溢出", "删减文案、固定字号、逐页渲染检查"],
    ["Git / push 网络问题", "先完成本地验证，网络恢复后单独处理"],
  ];
  rows.forEach((row, r) => {
    const y = 190 + r * 86;
    row.forEach((value, i) => {
      rect(ctx, slide, x[i], y, x[i + 1] - x[i], 86, r % 2 ? "#F8FAFC" : C.white, C.border, 1);
      text(ctx, slide, value, x[i] + 18, y + 14, x[i + 1] - x[i] - 36, 58, i === 0 ? 30 : 29, C.ink, i === 0, "left", "middle");
    });
  });
  return slide;
}

export async function renderSlide09(presentation, ctx) {
  const slide = presentation.slides.add();
  rect(ctx, slide, 0, 0, 1280, 720, C.paper, C.paper, 0);
  screenshotRail(ctx, slide, "Reader 让代码类教材更容易定位和阅读", ["Books / Reader 阅读链路", "代码块识别与目录", "语言筛选与键盘高亮"], "阅读体验已形成可演示闭环", 9);
  await screenshot(ctx, slide, "04-reader-top.png", 64, 132, 720, 456);
  return slide;
}

export async function renderSlide10(presentation, ctx) {
  const slide = presentation.slides.add();
  rect(ctx, slide, 0, 0, 1280, 720, C.paper, C.paper, 0);
  screenshotRail(ctx, slide, "导入预览先整理内容，再决定是否保存", ["文本粘贴与章节切分", "重命名、排除、撤销恢复", "保存按钮禁用，不写数据库"], "PREVIEW ONLY · 未写 DB", 10);
  await screenshot(ctx, slide, "08-import-chapter-edit.png", 64, 132, 720, 456);
  rect(ctx, slide, 64, 548, 48, 40, "#F3F5F7", "#F3F5F7", 0);
  return slide;
}

export async function renderSlide11(presentation, ctx) {
  const slide = presentation.slides.add();
  rect(ctx, slide, 0, 0, 1280, 720, C.paper, C.paper, 0);
  screenshotRail(ctx, slide, "Desktop 展示本地学习状态和行动提示", ["本地阅读进度", "书签与学习状态预览", "今日学习行动提示"], "LOCAL ONLY · 未连接后端", 11);
  await screenshot(ctx, slide, "11-desktop-home.png", 64, 132, 720, 456);
  return slide;
}

export async function renderSlide12(presentation, ctx) {
  const slide = presentation.slides.add();
  rect(ctx, slide, 0, 0, 1280, 720, C.paper, C.paper, 0);
  header(ctx, slide, "MVP 验证了核心流程，下一步补齐真实能力", "总结与反思", 12);
  panel(ctx, slide, 64, 134, 500, 466, C.white);
  label(ctx, slide, "项目收获", 102, 170, 420);
  bullet(ctx, slide, "掌握 AI 协作开发与需求拆解方法", 102, 226, 420, 62, C.blue, 30);
  bullet(ctx, slide, "理解前后端架构、测试和安全边界", 102, 306, 420, 62, C.cyan, 30);
  bullet(ctx, slide, "完成视频、PPT 与答辩材料制作", 102, 386, 420, 62, C.amber, 30);
  label(ctx, slide, "关键反思", 102, 478, 420, C.blue);
  text(ctx, slide, "挑战：范围大、上下文长、UI 待优化", 102, 522, 420, 30, 24, C.ink, false);
  text(ctx, slide, "应对：小轮迭代、阶段总结、预览机制", 102, 560, 420, 30, 24, C.ink, false);
  panel(ctx, slide, 604, 134, 612, 466, C.white);
  label(ctx, slide, "后续路线", 642, 170, 520);
  const roadmap = [
    ["近期", "真实登录与数据库保存", C.blue],
    ["中期", "LLM / RAG 与 PDF、EPUB、URL 导入", C.cyan],
    ["长期", "Desktop 深度集成与 UI 优化", C.amber],
  ];
  roadmap.forEach(([stage, item, color], i) => {
    const y = 232 + i * 104;
    rect(ctx, slide, 642, y, 108, 58, color, color, 0, "roundRect");
    text(ctx, slide, stage, 642, y + 8, 108, 42, 28, C.white, true, "center", "middle");
    text(ctx, slide, item, 778, y, 390, 58, 29, C.ink, false, "left", "middle");
    if (i < 2) rect(ctx, slide, 694, y + 62, 4, 38, C.border, C.border, 0);
  });
  text(ctx, slide, "当前阶段：MVP / preview-only / disabled-by-default", 64, 628, 1050, 42, 28, C.navy, true, "center", "middle", C.paleAmber);
  return slide;
}
