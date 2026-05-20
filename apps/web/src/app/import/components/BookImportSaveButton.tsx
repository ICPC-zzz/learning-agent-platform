"use client";

import { useActionState } from "react";

import { saveImportedPlainTextBookAction } from "../actions";
import type {
  BookImportSaveActionState,
  BookImportSaveFormInput,
} from "../book-import-save-types";
import { BookImportSaveStatus } from "./BookImportSaveStatus";

interface BookImportSaveButtonProps {
  input: BookImportSaveFormInput;
}

const initialSaveState: BookImportSaveActionState = {
  ok: null,
  status: "local_preview",
  message:
    "本地预览已就绪。保存前会在服务端重新校验并重新导入，然后只写入 Book、Chapter 和 Chunk 记录。",
};

export function BookImportSaveButton({ input }: BookImportSaveButtonProps) {
  const [state, formAction, isPending] = useActionState(
    saveImportedPlainTextBookAction,
    initialSaveState,
  );

  return (
    <section
      aria-labelledby="import-save-title"
      style={{
        borderTop: "1px solid #d8dee8",
        marginTop: "18px",
        paddingTop: "18px",
      }}
    >
      <div className="panelHeaderRow">
        <div>
          <p className="eyebrow">A24 保存边界</p>
          <h2 id="import-save-title">保存导入结果</h2>
          <p className="panelNote">
            仅保存最近一次生成预览对应的 Book、Chapter 和 Chunk 数据。
          </p>
        </div>
        <form action={formAction}>
          <input name="title" type="hidden" value={input.title} />
          <input name="author" type="hidden" value={input.author} />
          <input name="language" type="hidden" value={input.language} />
          <input name="content" type="hidden" value={input.content} />
          <input
            name="maxChunkChars"
            type="hidden"
            value={input.maxChunkChars}
          />
          <input
            name="overlapChars"
            type="hidden"
            value={input.overlapChars}
          />
          <button disabled={isPending} type="submit">
            {isPending ? "保存中..." : "保存到数据库"}
          </button>
        </form>
      </div>

      <BookImportSaveStatus isSaving={isPending} state={state} />
    </section>
  );
}
