export interface BookImportSaveResultLinks {
  detailHref: string;
  readerHref: string;
  libraryHref: string;
}

export function createBookImportSaveResultLinks(
  bookId: string,
): BookImportSaveResultLinks {
  const encodedBookId = encodeURIComponent(bookId);

  return {
    detailHref: `/books/${encodedBookId}`,
    readerHref: `/reader?bookId=${encodedBookId}`,
    libraryHref: "/books",
  };
}
