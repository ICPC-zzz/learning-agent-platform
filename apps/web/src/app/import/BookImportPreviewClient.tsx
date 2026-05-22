"use client";

import {
  importPlainTextBook,
  normalizePlainText,
  type JsonObject,
  type TextImportInput,
} from "@learning-agent-platform/book-engine";
import { useId, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";

import type {
  ImportLanguage,
  ImportPreviewViewModel,
} from "./book-import-preview-types";
import {
  BOOK_IMPORT_MAX_CONTENT_CHARS,
  BOOK_IMPORT_MIN_CONTENT_CHARS,
  type BookImportSaveFormInput,
} from "./book-import-save-types";
import {
  DEFAULT_PREVIEW_MAX_CHUNK_CHARS,
  DEFAULT_PREVIEW_OVERLAP_CHARS,
  buildImportPreviewViewModel,
} from "./book-import-preview-utils";
import { BookImportSaveButton } from "./components/BookImportSaveButton";

const languageOptions: ReadonlyArray<{
  value: ImportLanguage;
  label: string;
}> = [
  { value: "auto", label: "自动识别" },
  { value: "zh", label: "中文" },
  { value: "en", label: "英文" },
];

interface ValidatedImportRequest {
  input: TextImportInput;
  totalChars: number;
  maxChunkChars: number;
  overlapChars: number;
}

interface OptionalIntegerResult {
  value?: number;
  error?: string;
}

const formStackStyle: CSSProperties = {
  display: "grid",
  gap: "16px",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: "6px",
  color: "#263241",
  fontWeight: 700,
};

const fieldHintStyle: CSSProperties = {
  color: "#6c7483",
  fontSize: "0.875rem",
  fontWeight: 500,
  lineHeight: 1.5,
};

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: "42px",
  border: "1px solid #d8dee8",
  borderRadius: "8px",
  color: "#1c2430",
  font: "inherit",
  padding: "10px 12px",
};

const twoColumnFormGridStyle: CSSProperties = {
  display: "grid",
  gap: "14px",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

export function BookImportPreviewClient() {
  const formId = useId();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [language, setLanguage] = useState<ImportLanguage>("auto");
  const [content, setContent] = useState("");
  const [maxChunkChars, setMaxChunkChars] = useState(
    String(DEFAULT_PREVIEW_MAX_CHUNK_CHARS),
  );
  const [overlapChars, setOverlapChars] = useState(
    String(DEFAULT_PREVIEW_OVERLAP_CHARS),
  );
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreviewViewModel | null>(null);
  const [previewSaveInput, setPreviewSaveInput] =
    useState<BookImportSaveFormInput | null>(null);
  const [previewRevision, setPreviewRevision] = useState(0);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationResult = validateImportForm({
      title,
      author,
      language,
      content,
      maxChunkChars,
      overlapChars,
    });

    if ("errors" in validationResult) {
      setValidationErrors(validationResult.errors);
      setImportError(null);
      setPreview(null);
      setPreviewSaveInput(null);
      return;
    }

    setValidationErrors([]);
    setImportError(null);

    try {
      const result = importPlainTextBook(validationResult.input);
      setPreview(
        buildImportPreviewViewModel({
          result,
          language,
          totalChars: validationResult.totalChars,
          maxChunkChars: validationResult.maxChunkChars,
          overlapChars: validationResult.overlapChars,
        }),
      );
      setPreviewSaveInput({
        title: validationResult.input.title,
        author: validationResult.input.author ?? "",
        language,
        content,
        maxChunkChars: String(validationResult.maxChunkChars),
        overlapChars: String(validationResult.overlapChars),
      });
      setPreviewRevision((revision) => revision + 1);
    } catch (error) {
      setPreview(null);
      setPreviewSaveInput(null);
      setImportError(
        error instanceof Error
          ? `规则式导入预览失败：${error.message}`
          : "规则式导入预览失败，原因未知。未调用 AI、RAG 或真实 provider。",
      );
    }
  }

  return (
    <div className="dashboardGrid">
      <section className="learningPanel askAiPanel" aria-labelledby="import-form-title">
        <p className="eyebrow">纯文本预览</p>
        <h2 id="import-form-title">输入标题和正文</h2>
        <p className="panelNote">
          在这里粘贴正文文本，并在页面状态中生成规则式预览；这里不会读取 URL、上传文件或调用 AI。
        </p>

        <form onSubmit={handleSubmit} style={{ ...formStackStyle, marginTop: "18px" }}>
          <label htmlFor={`${formId}-title`} style={fieldStyle}>
            书名
            <input
              id={`${formId}-title`}
              onChange={(event) => setTitle(event.currentTarget.value)}
              placeholder="例如：TypeScript 笔记"
              style={inputStyle}
              type="text"
              value={title}
            />
          </label>

          <div style={twoColumnFormGridStyle}>
            <label htmlFor={`${formId}-author`} style={fieldStyle}>
              作者
              <input
                id={`${formId}-author`}
                onChange={(event) => setAuthor(event.currentTarget.value)}
                placeholder="可选"
                style={inputStyle}
                type="text"
                value={author}
              />
            </label>

            <label htmlFor={`${formId}-language`} style={fieldStyle}>
              语言
              <select
                id={`${formId}-language`}
                onChange={(event) =>
                  setLanguage(parseImportLanguage(event.currentTarget.value))
                }
                style={inputStyle}
                value={language}
              >
                {languageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label htmlFor={`${formId}-content`} style={fieldStyle}>
            纯文本内容
            <textarea
              id={`${formId}-content`}
              onChange={(event) => setContent(event.currentTarget.value)}
              placeholder="粘贴至少 20 个字符的正文文本。没有检测到标题时会生成一个“正文”章节。"
              value={content}
            />
            <span style={fieldHintStyle}>
              A152 当前仅支持粘贴文本的规则式预览。URL、PDF、EPUB、网页和文件导入未启用；复杂章节识别仍是 preview，不会调用 AI、RAG 或真实 provider。
            </span>
          </label>

          <div style={twoColumnFormGridStyle}>
            <label htmlFor={`${formId}-max-chunk`} style={fieldStyle}>
              最大 chunk 字符数（maxChunkChars）
              <input
                id={`${formId}-max-chunk`}
                inputMode="numeric"
                onChange={(event) => setMaxChunkChars(event.currentTarget.value)}
                placeholder={String(DEFAULT_PREVIEW_MAX_CHUNK_CHARS)}
                style={inputStyle}
                type="text"
                value={maxChunkChars}
              />
            </label>

            <label htmlFor={`${formId}-overlap`} style={fieldStyle}>
              重叠字符数（overlapChars）
              <input
                id={`${formId}-overlap`}
                inputMode="numeric"
                onChange={(event) => setOverlapChars(event.currentTarget.value)}
                placeholder={String(DEFAULT_PREVIEW_OVERLAP_CHARS)}
                style={inputStyle}
                type="text"
                value={overlapChars}
              />
            </label>
          </div>

          <button type="submit">生成规则式预览</button>
        </form>

        <ValidationMessages
          importError={importError}
          validationErrors={validationErrors}
        />
      </section>

      <section className="learningPanel" aria-labelledby="import-boundary-title">
        <p className="eyebrow">A152 边界</p>
        <h2 id="import-boundary-title">文本预览范围</h2>
        <dl className="scoreMeta">
          <SummaryRow label="数据来源" value="本地规则式预览" />
          <SummaryRow label="初始持久化状态" value="未保存" />
          <SummaryRow label="保存边界" value="服务端 action；仅当前开发环境" />
          <SummaryRow label="开发数据源写入范围" value="Book / Chapter / Chunk" />
          <SummaryRow label="章节策略" value="规则式预览；无标题时使用单章节 fallback" />
        </dl>
        <div className="warningBlock">
          <h3>此页面不会执行的操作</h3>
          <ul>
            <li>不会保存 ReadingProgress、User、Learning、Recommendation、AI、RAG 或 provider 数据。</li>
            <li>不会创建 API routes、migration、seed 数据、认证、session 或 cookie。</li>
            <li>不会导入 PDF、EPUB、URL、HTML、上传文件或本地文件。</li>
            <li>不会做复杂章节解析，也不会调用 AI、RAG、provider 或任何真实 LLM。</li>
          </ul>
        </div>
      </section>

      {preview !== null && previewSaveInput !== null ? (
        <ImportPreviewResult
          preview={preview}
          previewRevision={previewRevision}
          saveInput={previewSaveInput}
        />
      ) : null}
    </div>
  );
}

function ValidationMessages({
  validationErrors,
  importError,
}: {
  validationErrors: string[];
  importError: string | null;
}) {
  if (validationErrors.length === 0 && importError === null) {
    return null;
  }

  return (
    <div aria-live="polite" className="learningEmptyState" role="alert">
      <strong>无法生成预览。</strong>
      {validationErrors.length > 0 ? (
        <ul>
          {validationErrors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}
      {importError !== null ? <p>{importError}</p> : null}
    </div>
  );
}

function ImportPreviewResult({
  preview,
  previewRevision,
  saveInput,
}: {
  preview: ImportPreviewViewModel;
  previewRevision: number;
  saveInput: BookImportSaveFormInput;
}) {
  return (
    <section
      className="learningPanel recommendationPanel"
      aria-labelledby="preview-result-title"
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">规则式导入预览</p>
          <h2 id="preview-result-title">{preview.title}</h2>
          <p className="panelNote">
            {preview.author ?? "未知作者"} · 语言：{formatImportLanguage(preview.language)}
          </p>
        </div>
        <span className="difficultyBadge">{formatPreviewSource(preview.source)}</span>
      </div>

      <dl className="scoreMeta" style={{ marginTop: "18px" }}>
        <SummaryRow
          label="持久化状态"
          value={formatPersistenceStatus(preview.persistenceStatus)}
        />
        <SummaryRow label="章节总数" value={preview.totalChapters} />
        <SummaryRow label="chunk 总数" value={preview.totalChunks} />
        <SummaryRow label="原文字符数" value={preview.totalChars} />
        <SummaryRow
          label="最大 chunk 字符数（maxChunkChars）"
          value={preview.chunkSettings.maxChunkChars}
        />
        <SummaryRow
          label="重叠字符数（overlapChars）"
          value={preview.chunkSettings.overlapChars}
        />
        <SummaryRow
          label="解析说明"
          value="规则式文本预览；未检测到章节标题时会作为单章节 fallback 展示，只有点击保存后才写入开发数据源。"
        />
      </dl>

      {preview.warnings.length > 0 ? (
        <div className="warningBlock">
          <h3>预览警告</h3>
          <ul>
            {preview.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <BookImportSaveButton key={previewRevision} input={saveInput} />

      <div className="chunkPanel">
        <div className="panelHeader">
          <p className="eyebrow">章节预览列表</p>
          <h2>章节与 chunk 预览</h2>
          <p className="panelNote">
            当前显示前 {preview.chapterPreviewLimit} 个章节，且每章最多显示{" "}
            {preview.chunkPreviewLimitPerChapter} 个 chunk。上方统计基于完整规则式预览结果。
          </p>
        </div>

        {preview.chapters.length > 0 ? (
          <div className="chunkList">
            {preview.chapters.map((chapter) => (
              <article className="chunkItem" key={chapter.id}>
                <div className="chunkMeta">
                  <span>#{chapter.orderIndex + 1}</span>
                  <span>{chapter.chunkCount} 个 chunk</span>
                </div>
                <h3>{chapter.title}</h3>
                <p>
                  层级 {chapter.level} · {chapter.charCount} 个字符
                </p>
                <p>{chapter.previewText || "未检测到章节正文。"}</p>
                <ChunkPreviewList chapter={chapter} />
              </article>
            ))}
          </div>
        ) : (
          <p className="learningEmptyState">
            当前文本未生成章节。
          </p>
        )}

        {preview.omittedChapterCount > 0 ? (
          <p className="askAiLimit">
            为保持页面响应流畅，当前预览省略了另外 {preview.omittedChapterCount} 个章节。
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ChunkPreviewList({
  chapter,
}: {
  chapter: ImportPreviewViewModel["chapters"][number];
}) {
  if (chapter.previewChunks.length === 0) {
    return <p className="askAiLimit">此章节未生成 chunk。</p>;
  }

  return (
    <div className="mockQaHistory">
      {chapter.previewChunks.map((chunk) => (
        <div className="mockQaCard" key={chunk.id}>
          <div className="chunkMeta">
            <span>Chunk #{chunk.orderIndex + 1}</span>
            <span>{chunk.charCount} 个字符</span>
          </div>
          <p>{chunk.previewText}</p>
        </div>
      ))}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function validateImportForm(input: {
  title: string;
  author: string;
  language: ImportLanguage;
  content: string;
  maxChunkChars: string;
  overlapChars: string;
}): ValidatedImportRequest | { errors: string[] } {
  const errors: string[] = [];
  const title = input.title.trim();
  const author = input.author.trim();
  const normalizedText = normalizePlainText(input.content);

  if (title.length === 0) {
    errors.push("必须填写书名。");
  }

  if (normalizedText.length === 0) {
    errors.push("必须填写纯文本内容。");
  } else if (normalizedText.length < BOOK_IMPORT_MIN_CONTENT_CHARS) {
    errors.push(
      `纯文本内容至少需要 ${BOOK_IMPORT_MIN_CONTENT_CHARS} 个字符。`,
    );
  } else if (normalizedText.length > BOOK_IMPORT_MAX_CONTENT_CHARS) {
    errors.push(
      `纯文本内容不能超过 ${BOOK_IMPORT_MAX_CONTENT_CHARS} 个字符。`,
    );
  }

  const parsedMaxChunkChars = parseOptionalInteger(
    input.maxChunkChars,
    "maxChunkChars",
    { min: 1 },
  );
  const parsedOverlapChars = parseOptionalInteger(
    input.overlapChars,
    "overlapChars",
    { min: 0 },
  );

  if (parsedMaxChunkChars.error !== undefined) {
    errors.push(parsedMaxChunkChars.error);
  }

  if (parsedOverlapChars.error !== undefined) {
    errors.push(parsedOverlapChars.error);
  }

  const effectiveMaxChunkChars =
    parsedMaxChunkChars.value ?? DEFAULT_PREVIEW_MAX_CHUNK_CHARS;
  const defaultOverlapChars = Math.min(
    DEFAULT_PREVIEW_OVERLAP_CHARS,
    Math.max(0, effectiveMaxChunkChars - 1),
  );
  const effectiveOverlapChars = parsedOverlapChars.value ?? defaultOverlapChars;

  if (effectiveOverlapChars >= effectiveMaxChunkChars) {
    errors.push("overlapChars 必须小于 maxChunkChars。");
  }

  if (errors.length > 0) {
    return { errors };
  }

  const sourceMetadata: JsonObject = {
    language: input.language,
    previewSource: "local_preview",
  };
  const chunkingOptions: NonNullable<TextImportInput["chunkingOptions"]> = {};

  if (parsedMaxChunkChars.value !== undefined) {
    chunkingOptions.maxChunkChars = parsedMaxChunkChars.value;
  }

  if (parsedOverlapChars.value !== undefined) {
    chunkingOptions.overlapChars = parsedOverlapChars.value;
  }

  return {
    input: {
      title,
      sourceText: input.content,
      author: author.length > 0 ? author : undefined,
      sourceType: "imported_text",
      sourceMetadata,
      chapteringOptions: {
        fallbackChapterTitle: "正文",
      },
      chunkingOptions:
        parsedMaxChunkChars.value !== undefined ||
        parsedOverlapChars.value !== undefined
          ? chunkingOptions
          : undefined,
    },
    totalChars: normalizedText.length,
    maxChunkChars: effectiveMaxChunkChars,
    overlapChars: effectiveOverlapChars,
  };
}

function parseOptionalInteger(
  rawValue: string,
  label: string,
  bounds: { min: number },
): OptionalIntegerResult {
  const trimmedValue = rawValue.trim();

  if (trimmedValue.length === 0) {
    return {};
  }

  if (!/^\d+$/.test(trimmedValue)) {
    return {
      error: `${label} 必须是整数。`,
    };
  }

  const parsedValue = Number(trimmedValue);

  if (!Number.isSafeInteger(parsedValue) || parsedValue < bounds.min) {
    return {
      error: `${label} 至少为 ${bounds.min}。`,
    };
  }

  return {
    value: parsedValue,
  };
}

function parseImportLanguage(value: string): ImportLanguage {
  return value === "zh" || value === "en" ? value : "auto";
}

function formatImportLanguage(language: ImportLanguage): string {
  if (language === "zh") {
    return "中文";
  }

  if (language === "en") {
    return "英文";
  }

  return "自动识别";
}

function formatPreviewSource(source: ImportPreviewViewModel["source"]): string {
  return source === "local_preview" ? "本地预览" : source;
}

function formatPersistenceStatus(
  status: ImportPreviewViewModel["persistenceStatus"],
): string {
  return status === "not_saved" ? "未保存" : status;
}
