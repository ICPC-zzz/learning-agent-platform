import { getReaderDataFromDatabaseResult } from "./reader-db";
import { getReaderDataFromMock } from "./reader-mock";
import type { ReaderPageData } from "./reader-types";

interface GetReaderPageDataInput {
  bookId?: string;
}

export async function getReaderPageData(
  input: GetReaderPageDataInput = {}
): Promise<ReaderPageData> {
  const databaseResult = await getReaderDataFromDatabaseResult({
    bookId: input.bookId
  });

  if (databaseResult.data !== null) {
    return databaseResult.data;
  }

  return getReaderDataFromMock(databaseResult.fallbackReason);
}
