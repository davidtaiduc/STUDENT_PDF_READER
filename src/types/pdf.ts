export interface PdfDocumentInfo {
  name: string;
  size: number;
  pageCount: number;
}

export interface PdfViewerState {
  currentPage: number;
  totalPages: number;
  scale: number;
}
