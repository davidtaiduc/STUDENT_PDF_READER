export interface PdfSelection {
  /** Display text with displaced wide blocks restored to visual position. */
  text: string;
  /** Unmodified browser selection, retained for diagnostics and later cleanup. */
  rawText: string;
  pageNumber: number;
  /** Viewport CSS pixels, suitable for positioning a future floating toolbar. */
  rect: DOMRect;
  /** Individual line/fragment rectangles, also in viewport CSS pixels. */
  rects: DOMRect[];
}
