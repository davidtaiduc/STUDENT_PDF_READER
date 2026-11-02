import * as pdfjsLib from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url,
).toString();

// Resolve relative deployments against the HTML page, not the worker's assets/ URL.
const pdfAssetBase = new URL(`${import.meta.env.BASE_URL}pdfjs/`, document.baseURI).href;
export { pdfjsLib, pdfAssetBase };
