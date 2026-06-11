export function DemoModeNotice() {
  return (
    <section
      aria-label="演示模式提醒"
      className="demoModeNotice"
    >
      <span className="demoModeBadge">演示模式</span>
      <p>
        当前阅读器使用演示/预览数据。阅读进度仍以章节级预览为主；
        本章已读、滚动位置、阅读计时和当前可见内容块提示均为当前浏览器本地预览能力，
        数据库同步能力仅限开发预览，不代表真实学习闭环。AI 问答、RAG 与真实模型 provider 均未启用。
      </p>
    </section>
  );
}
