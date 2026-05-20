import styles from "./page.module.css";

export const coreRuntimePreviewSafetyLabels = [
  "仅预览",
  "未执行工具",
  "未调用模型",
  "无真实副作用",
] as const;

export const extendedRuntimePreviewSafetyLabels = [
  ...coreRuntimePreviewSafetyLabels,
  "权限流程未启用",
  "后台任务未启用",
  "真实运行未启用",
  "生产审计未启用",
] as const;

export function RuntimePreviewSafetyLabels({
  labels = coreRuntimePreviewSafetyLabels,
}: {
  labels?: readonly string[];
}) {
  return (
    <ul className={styles.inlineList}>
      {labels.map((label) => (
        <li key={label}>{label}</li>
      ))}
    </ul>
  );
}
