import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

/**
 * Browser entry to the PDF reader. Imported lazily when a PDF is picked, so
 * pdf.js stays out of the main bundle. The legacy build matches the one the
 * ingest script runs under Node.
 */
GlobalWorkerOptions.workerSrc = workerUrl;

export { readPdfWords } from "../../ingest/readPdf";
