export type BookLibraryStatus =
  | "loaded"
  | "empty"
  | "database_unavailable"
  | "read_failed"
  | "mock_fallback";

export interface BookLibraryItemView {
  id: string;
  title: string;
  author?: string;
  language?: string;
  sourceType?: string;
  summary?: string;
  chapterCount?: number;
  chunkCount?: number;
  createdAtLabel?: string;
  updatedAtLabel?: string;
  detailHref: string;
}

export interface BookLibraryLoadResult {
  status: BookLibraryStatus;
  books: BookLibraryItemView[];
  message: string;
}
