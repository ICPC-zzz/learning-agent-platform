"use client";

import { useActionState, useRef } from "react";
import { renameImportedBook, type RenameBookActionResult } from "./actions";

interface ManageBookRenameFormProps {
  bookId: string;
  currentTitle: string;
}

const initialRenameState: RenameBookActionResult = {
  success: false,
  bookId: "",
  newTitle: null,
  reasonCode: "initial",
  message: "",
  safeToExposeToClient: true,
  devOnly: true,
};

export function ManageBookRenameForm({ bookId, currentTitle }: ManageBookRenameFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    renameImportedBook,
    initialRenameState,
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "280px" }}
    >
      <input type="hidden" name="bookId" value={bookId} />
      <input
        type="text"
        name="title"
        defaultValue={currentTitle}
        maxLength={120}
        required
        style={{
          flex: 1,
          padding: "6px 10px",
          border: "1px solid var(--color-border, #e2e8f0)",
          borderRadius: "6px",
          fontSize: "13px",
          minWidth: 0,
        }}
      />
      <button
        type="submit"
        disabled={isPending}
        style={{
          padding: "6px 12px",
          background: "#3b82f6",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          fontSize: "12px",
          fontWeight: 600,
          cursor: isPending ? "not-allowed" : "pointer",
          opacity: isPending ? 0.6 : 1,
          whiteSpace: "nowrap",
        }}
      >
        {isPending ? "Saving..." : "Rename"}
      </button>
      {state.message && state.bookId === bookId ? (
        <span
          style={{
            fontSize: "11px",
            color: state.success ? "#16a34a" : "#dc2626",
            whiteSpace: "nowrap",
          }}
        >
          {state.success ? "✓" : "✗"} {state.message}
        </span>
      ) : null}
    </form>
  );
}
