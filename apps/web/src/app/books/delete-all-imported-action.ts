"use server";

import { revalidatePath } from "next/cache";
import { getPrismaClient, PrismaBookRepository } from "@learning-agent-platform/db";
import { isSampleBookId } from "./sample-programming-books";

export interface DeleteAllImportedResult {
  success: boolean; deleted: number; protected: number; failed: number; message: string;
}

export async function deleteAllImportedBooksAction(): Promise<DeleteAllImportedResult> {
  let deleted = 0, protected_ = 0, failed = 0;
  try {
    const repo = new PrismaBookRepository(getPrismaClient());
    const allBooks = await repo.listBooks({ limit: 99999 });
    for (const book of allBooks) {
      if (isSampleBookId(book.id)) { protected_++; continue; }
      try {
        const r = await repo.deleteBook({ bookId: book.id });
        if (r.deleted) deleted++; else failed++;
      } catch { failed++; }
    }
    revalidatePath("/books", "page");
    revalidatePath("/books", "layout");
  } catch (err) {
    return { success: false, deleted, protected: protected_, failed,
      message: String(err).slice(0, 200) };
  }
  return { success: true, deleted, protected: protected_, failed,
    message: `Deleted ${deleted}, ${protected_} protected, ${failed} failed.` };
}
