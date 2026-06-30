import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

var __dirname = dirname(fileURLToPath(import.meta.url));

var deleteActionSource = readFileSync(resolve(__dirname,"books","delete-book-actions.ts"),"utf-8");
var pageSource = readFileSync(resolve(__dirname,"books","page.tsx"),"utf-8");
var sampleBooksSource = readFileSync(resolve(__dirname,"books","sample-programming-books.ts"),"utf-8");
var clientSource = readFileSync(resolve(__dirname,"books","components","BookLibraryClient.tsx"),"utf-8");

describe("A472 Book Delete",function(){
  describe("delete action",function(){
    it("exports deleteBookAction",function(){assert.ok(deleteActionSource.includes("export async function deleteBookAction"),"should export deleteBookAction");});
    it("checks dev auth guard",function(){assert.ok(deleteActionSource.includes("isDevAuthAllowed"),"should check dev auth guard");});
    it("checks DB persist guard",function(){assert.ok(deleteActionSource.includes("evaluateImportDbPersistGuard"),"should check DB persist guard");});
    it("reads dev session",function(){assert.ok(deleteActionSource.includes("lap-web-dev-session"),"should read dev session");});
    it("validates bookId not empty",function(){assert.ok(deleteActionSource.includes("missing-book-id"),"should handle missing bookId");});
    it("protects built-in books via isSampleBookId",function(){assert.ok(deleteActionSource.includes("isSampleBookId"),"should check sample books");assert.ok(deleteActionSource.includes("builtin-protected"),"should have builtin-protected reason");});
    it("calls repository.deleteBook",function(){assert.ok(deleteActionSource.includes("repository.deleteBook"),"should call deleteBook");});
    it("revalidates path after delete",function(){assert.ok(deleteActionSource.includes('revalidatePath("/books")'),"should revalidate");});
    it("returns safe result",function(){assert.ok(deleteActionSource.includes("safeToExposeToClient: true"),"should be safe to expose");});
  });
  describe("built-in protection",function(){
    it("exports isSampleBookId",function(){assert.ok(sampleBooksSource.includes("export function isSampleBookId"),"should export isSampleBookId");});
    it("protects sample-python-basics",function(){assert.ok(sampleBooksSource.includes("sample-python-basics"),"should include python sample");});
    it("protects sample-js-async",function(){assert.ok(sampleBooksSource.includes("sample-js-async"),"should include js sample");});
    it("protects sample-algorithms-intro",function(){assert.ok(sampleBooksSource.includes("sample-algorithms-intro"),"should include algo sample");});
  });
  describe("delete UI",function(){
    it("has delete capability in client",function(){assert.ok(clientSource.includes("删除")||clientSource.includes("delete"),"should have delete text");});
    it("has confirmation dialog",function(){assert.ok(clientSource.includes("confirm")||clientSource.includes("Confirm")||clientSource.includes("确认"),"should have confirmation");});
    it("calls deleteBookAction",function(){assert.ok(clientSource.includes("deleteBookAction"),"should call deleteBookAction");});
    it("reloads page after delete",function(){assert.ok(clientSource.includes("window.location.reload"),"should reload");});
  });
  it("client imports delete-book-actions",function(){assert.ok(clientSource.includes("delete-book-actions"),"should import delete-book-actions");});
});

console.log("A472 book delete tests completed");
