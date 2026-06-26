import { createSessionSummaryMemoryItem } from "./session-summary";
import {
  matchesMemorySearchFilters,
  rankMemoryResults,
} from "./search";
import type {
  MemoryAddInput,
  MemoryItem,
  MemorySearchQuery,
  MemorySearchResult,
  MemorySessionSummaryInput,
  MemoryStore,
} from "./types";
import {
  cloneMemoryItem,
  completeMemoryItem,
  createMemoryId,
} from "./utils";

export class InMemoryMemoryStore implements MemoryStore {
  private readonly items: MemoryItem[] = [];
  private readonly ids = new Set<string>();
  private nextId = 1;

  constructor(initialItems: readonly MemoryAddInput[] = []) {
    for (const item of initialItems) {
      const completed = this.completeItem(item);
      this.items.push(completed);
      this.ids.add(completed.id);
    }
  }

  async add(item: MemoryAddInput): Promise<MemoryItem> {
    const completed = this.completeItem(item);
    this.items.push(completed);
    this.ids.add(completed.id);
    return cloneMemoryItem(completed);
  }

  async search(query: MemorySearchQuery): Promise<MemorySearchResult[]> {
    const filteredItems = this.items.filter((item) =>
      matchesMemorySearchFilters(item, query),
    );
    return rankMemoryResults(filteredItems, query);
  }

  async summarizeSession(
    request: MemorySessionSummaryInput,
  ): Promise<MemoryItem> {
    const messages = this.resolveSummaryMessages(request);
    return this.add(
      createSessionSummaryMemoryItem({
        ...request,
        messages,
      }),
    );
  }

  private completeItem(item: MemoryAddInput): MemoryItem {
    const id = item.id ?? this.createUniqueId();
    return completeMemoryItem(item, id);
  }

  private createUniqueId(): string {
    let id = createMemoryId(this.nextId);
    this.nextId += 1;

    while (this.ids.has(id)) {
      id = createMemoryId(this.nextId);
      this.nextId += 1;
    }

    return id;
  }

  private resolveSummaryMessages(
    request: MemorySessionSummaryInput,
  ): readonly string[] {
    if (request.text !== undefined) {
      return [request.text];
    }

    if (request.messages !== undefined) {
      return request.messages;
    }

    if (request.sourceItemIds !== undefined) {
      const sourceItemIds = new Set(request.sourceItemIds);
      return this.items
        .filter((item) => sourceItemIds.has(item.id))
        .map((item) => item.content);
    }

    return this.items
      .filter((item) => item.sessionId === request.sessionId)
      .map((item) => item.content);
  }
}
