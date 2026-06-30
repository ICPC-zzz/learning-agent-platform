"use client";

import { useState, useMemo, useCallback } from "react";
import type { BookLibraryItemView } from "../book-library-types";
import { filterBooks, getDefinedCategories, collectCategories } from "../book-library-filter";
import { deleteBookAction, type DeleteBookActionResult } from "../delete-book-actions";
import { BookSourceBadge } from "../../_components/UserUiComponents";

const CAT_COLORS: Record<string, string> = {
  Python: "#3776AB", JavaScript: "#F7DF1E", Algorithm: "#E34F26",
  "Data Structures": "#2E8B57", Database: "#336791",
  "Web Dev": "#61DAFB", "Machine Learning": "#FF6F00",
  "System Design": "#6C5CE7", Java: "#ED8B00",
  Go: "#00ADD8", Rust: "#DEA584", "C/C++": "#00599C",
  Linux: "#FCC624", Security: "#DC143C", Testing: "#7B68EE",
  DevOps: "#2496ED",
};

export interface BookLibraryClientProps {
  books: BookLibraryItemView[];
  canDelete: boolean;
  dbFavoritesEnabled?: boolean;
  devSessionOwnerId?: string | null;
}

export function BookLibraryClient({ books, canDelete }: BookLibraryClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [deleteTarget, setDeleteTarget] = useState<BookLibraryItemView | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const defined = getDefinedCategories();
  const allCategories = useMemo(() => {
    const merged = new Set<string>(["All", ...defined]);
    for (const b of books) { const c = (b.category || "").trim(); if (c) merged.add(c); }
    return Array.from(merged);
  }, [books, defined]);

  const filtered = useMemo(() => {
    const categoryFilter = activeCategory === "All" ? "" : activeCategory;
    return filterBooks(books, { searchQuery, categoryFilter });
  }, [books, searchQuery, activeCategory]);

  const handleDeleteClick = useCallback((book: BookLibraryItemView) => { setDeleteTarget(book); setDeleteError(""); }, []);
  const handleDeleteCancel = useCallback(() => { setDeleteTarget(null); setDeleteError(""); }, []);
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return; setDeleting(true); setDeleteError("");
    try {
      const formData = new FormData(); formData.set("bookId", deleteTarget.id);
      const result: DeleteBookActionResult = await deleteBookAction(null, formData);
      if (result.success) { setDeleteTarget(null); window.location.reload(); }
      else setDeleteError(result.message);
    } catch (err) { setDeleteError(err instanceof Error ? err.message : "Delete failed"); }
    finally { setDeleting(false); }
  }, [deleteTarget]);

  return (
    <>
      <div style={{ marginTop: "var(--lap-space-4)" }}>
        <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
          <input type="search" placeholder="Search title, author, description..." value={searchQuery}
            onChange={function(e) { setSearchQuery(e.target.value); }}
            style={{ flex: 1, minWidth: "240px", minHeight: "44px", border: "1px solid var(--lap-border)", borderRadius: "10px", padding: "8px 16px", font: "inherit", fontSize: "0.9rem" }}
            maxLength={200} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "20px" }}>
          {allCategories.map(function(cat) {
            var color = CAT_COLORS[cat] || undefined;
            var active = activeCategory === cat;
            return (
              <button key={cat} onClick={function() { setActiveCategory(cat); }} style={{
                padding: "6px 14px", borderRadius: "20px",
                border: "1px solid " + (active ? (color || "#2563eb") : "#d8dee8"),
                background: active ? (color || "#2563eb") : "#fff",
                color: active ? "#fff" : "var(--lap-text-secondary)",
                cursor: "pointer", fontSize: "0.78rem", fontWeight: 500, whiteSpace: "nowrap",
              }}>{cat}</button>
            );
          })}
        </div>
      </div>

      {filtered.hasActiveFilters ? (
        <p style={{ fontSize: "0.8rem", color: "var(--lap-text-muted)", marginBottom: "16px" }}>
          {filtered.totalAfter} / {filtered.totalBefore} books
        </p>
      ) : null}

      {filtered.books.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--lap-text-muted)", background: "#f9fafb", borderRadius: "12px" }}>
          {searchQuery || activeCategory !== "All" ? "No matching books. Adjust search or category." : "No books yet. Import via Open Library or custom import."}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {filtered.books.map(function(book) {
            return (
              <BookCard key={book.id} book={book}
                canDelete={canDelete && book.sourceType !== "builtin"}
                onDelete={function() { handleDeleteClick(book); }} />
            );
          })}
        </div>
      )}

      {deleteTarget ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
          onClick={handleDeleteCancel}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "28px", maxWidth: "380px", width: "90%" }}
            onClick={function(e) { e.stopPropagation(); }}>
            <h3 style={{ margin: "0 0 8px", fontSize: "1rem", fontWeight: 600 }}>Confirm Delete</h3>
            <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: "var(--lap-text-secondary)" }}>
              Delete "{deleteTarget.title}"? This cannot be undone.
            </p>
            {deleteError ? (
              <p style={{ fontSize: "0.8rem", color: "#ef4444", marginBottom: "12px", padding: "8px", background: "#fef0f0", borderRadius: "6px" }}>{deleteError}</p>
            ) : null}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button onClick={handleDeleteCancel} disabled={deleting}
                style={{ padding: "8px 20px", border: "1px solid #ccc", borderRadius: "8px", background: "#fff", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDeleteConfirm} disabled={deleting}
                style={{ padding: "8px 20px", border: "none", borderRadius: "8px", background: "#ef4444", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function getCoverColor(book: BookLibraryItemView): string {
  if (book.category && CAT_COLORS[book.category]) return CAT_COLORS[book.category];
  for (var k in CAT_COLORS) { if ((book.category || "").toLowerCase() === k.toLowerCase()) return CAT_COLORS[k]; }
  return "#6b7280";
}

function BookCard({ book, canDelete, onDelete }: { book: BookLibraryItemView; canDelete: boolean; onDelete: () => void }) {
  var coverColor = getCoverColor(book);
  return (
    <div style={{ background: "#fff", borderRadius: "12px", overflow: "hidden", border: "1px solid #e5e7eb", display: "flex", flexDirection: "column", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", transition: "box-shadow 0.2s, transform 0.15s" }}
      onMouseEnter={function(e) { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={function(e) { e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>
      {book.coverUrl ? (
        <div style={{ height: "120px", background: coverColor, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
          <img src={book.coverUrl} alt={book.title} loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }}
            onError={function(e) { (e.target as HTMLImageElement).style.display = "none"; }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "8px 12px", background: "linear-gradient(transparent, rgba(0,0,0,0.6))" }}>
            <span style={{ color: "#fff", fontSize: "0.7rem", fontWeight: 600 }}>{book.firstPublishYear || ""}</span>
          </div>
        </div>
      ) : (
        <div style={{ height: "120px", background: "linear-gradient(135deg, " + coverColor + ", " + coverColor + "cc)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <div style={{ position: "absolute", top: "-20px", right: "-20px", width: "80px", height: "80px", borderRadius: "50%", background: "rgba(255,255,255,0.15)" }} />
          <div style={{ position: "absolute", bottom: "-30px", left: "-10px", width: "60px", height: "60px", borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
          <span style={{ fontSize: "1.8rem", zIndex: 1 }}>B</span>
        </div>
      )}
      <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", flex: 1, gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "6px" }}>
          <h3 style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--lap-text-primary)", margin: 0, lineHeight: 1.35, flex: 1 }}>{book.title}</h3>
          <BookSourceBadge sourceType={book.sourceType} sourceLabel={book.sourceLabel || (book.sourceType === "builtin" ? "Builtin" : "Imported")} />
        </div>
        {book.author ? (<p style={{ fontSize: "0.78rem", color: "var(--lap-text-secondary)", margin: 0 }}>{book.author}</p>) : null}
        {book.category ? (
          <span style={{ display: "inline-block", fontSize: "0.62rem", fontWeight: 600, padding: "2px 8px", borderRadius: "999px", background: coverColor + "18", color: coverColor, alignSelf: "flex-start" }}>{book.category}</span>
        ) : null}
        {book.description || book.summary ? (
          <p style={{ fontSize: "0.76rem", color: "var(--lap-text-muted)", margin: 0, lineHeight: 1.55, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
            {book.description ? (book.description.length > 150 ? book.description.slice(0, 150) + "..." : book.description) : (book.summary || "")}
          </p>
        ) : (
          <p style={{ fontSize: "0.76rem", color: "#bbb", margin: 0, fontStyle: "italic", flex: 1 }}>No description</p>
        )}
        <div style={{ fontSize: "0.7rem", color: "#aaa" }}>
          {book.chapterCount != null ? book.chapterCount + " chapters" : ""}
          {book.language ? " / " + book.language : ""}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px solid #f0f0f0" }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <a href={book.detailHref} style={{ fontSize: "0.75rem", color: "#2563eb", textDecoration: "none", fontWeight: 500, padding: "4px 10px", borderRadius: "6px", background: "#eff6ff" }}>Detail</a>
            <a href={book.readerHref} style={{ fontSize: "0.75rem", color: "#16a34a", textDecoration: "none", fontWeight: 500, padding: "4px 10px", borderRadius: "6px", background: "#f0fdf4" }}>Read</a>
          </div>
          {canDelete ? (
            <button onClick={onDelete} style={{ fontSize: "0.7rem", padding: "3px 10px", borderRadius: "6px", border: "1px solid #ef4444", background: "transparent", color: "#ef4444", cursor: "pointer", fontWeight: 500 }}>Delete</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
