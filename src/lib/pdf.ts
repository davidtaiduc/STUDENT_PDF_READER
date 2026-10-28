import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url,
).toString();

const pdfAssetBase = `${import.meta.env.BASE_URL}pdfjs/`;
export { pdfjsLib, pdfAssetBase };
