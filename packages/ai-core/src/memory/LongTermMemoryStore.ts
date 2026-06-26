import { InMemoryMemoryStore } from "./in-memory-store.ts";
import type {
  MemoryAddInput,
  MemoryItem,
  MemorySearchQuery,
  MemorySearchResult,
} from "./types.ts";

export class LongTermMemoryStore {
  private readonly store: InMemoryMemoryStore;
  private readonly items: MemoryItem[] = [];

  constructor(initialItems: readonly MemoryAddInput[] = []) {
    this.store = new InMemoryMemoryStore(initialItems);
    for (const item of initialItems) {
      this.items.push({
        id: item.id ?? `init_${this.items.length + 1}`,
        ...(item.userId ? { userId: item.userId } : {}),
        ...(item.sessionId ? { sessionId: item.sessionId } : {}),
        layer: item.layer,
        content: item.content,
        importance: item.importance ?? 0.5,
        ...(item.metadata ? { metadata: item.metadata } : {}),
        createdAt: item.createdAt ?? new Date().toISOString(),
      });
    }
  }

  async add(item: MemoryAddInput): Promise<MemoryItem> {
    const added = await this.store.add(item);
    this.items.push({ ...added, ...(added.metadata ? { metadata: added.metadata } : {}) });
    return added;
  }

  async search(query: MemorySearchQuery): Promise<MemorySearchResult[]> {
    return this.store.search(query);
  }

  async summarizeSession(): Promise<never> {
    throw new Error("LongTermMemoryStore does not summarize sessions directly.");
  }

  list(): MemoryItem[] {
    return this.items.map((item) => ({
      ...item,
      ...(item.metadata === undefined ? {} : { metadata: item.metadata }),
    }));
  }
}
