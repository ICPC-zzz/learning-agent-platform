"use client";

import { useActionState } from "react";
import { archiveImportedBook, type ArchiveBookActionResult } from "./actions";

interface ManageBookArchiveFormProps {
  bookId: string;
  isArchived: boolean;
}

const initialArchiveState: ArchiveBookActionResult = {
  success: false,
  bookId: "",
  archived: false,
  reasonCode: "initial",
  message: "",
  safeToExposeToClient: true,
  devOnly: true,
};

export function ManageBookArchiveForm({ bookId, isArchived }: ManageBookArchiveFormProps) {
  const [state, formAction, isPending] = useActionState(
    archiveImportedBook,
    initialArchiveState,
  );

  return (
    <form action={formAction} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <input type="hidden" name="bookId" value={bookId} />
      <input type="hidden" name="archive" value={isArchived ? "false" : "true"} />
      <button
        type="submit"
        disabled={isPending}
        style={{
          padding: "6px 12px",
          background: isArchived ? "#10b981" : "#f59e0b",
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
        {isPending
          ? "Working..."
          : isArchived
            ? "Unarchive"
            : "Archive"}
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
