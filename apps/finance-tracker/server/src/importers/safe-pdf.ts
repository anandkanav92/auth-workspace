// PDF parsing safety harness (Task 6.0). User-uploaded PDFs are an untrusted
// input surface, so EVERY PDF read in the app goes through extractPositionedText
// here — never a raw pdfjs.getDocument() elsewhere. We rely on three layers of
// defence:
//   1. pdfjs-dist (Mozilla pdf.js) disables JS execution in PDFs by default and
//      we additionally pass isEvalSupported:false.
//   2. Our own size + page caps reject pathological inputs before/while parsing.
//   3. A wall-clock timeout bounds the parse so a crafted PDF can't hang a
//      request handler indefinitely.
//
// PDFs from our two brokers are digitally generated (clean text with stable
// coordinates), so this is position-aware text extraction — NOT OCR.

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_PAGES = 40;
const PARSE_TIMEOUT_MS = 15_000;

/** Thrown for any rejected/failed PDF parse (oversize, too many pages, timeout,
 * corrupt/non-PDF input). Callers map this to a 4xx, never a 500. */
export class PdfParseError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'PdfParseError';
  }
}

/** A single positioned text run: the string plus its baseline position in PDF
 * user-space (origin bottom-left; y grows upward) and 1-based page number. */
export type PositionedText = { str: string; x: number; y: number; page: number };

/**
 * Extract every non-blank text run from a PDF with its page + coordinates.
 * The ONLY sanctioned entry point for reading PDFs in this codebase.
 *
 * @throws PdfParseError on oversize input, too many pages, parse timeout, or a
 *   corrupt / non-PDF buffer.
 */
export async function extractPositionedText(
  buffer: Buffer,
): Promise<PositionedText[]> {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new PdfParseError(`file too large: ${buffer.length} bytes`);
  }

  let doc;
  try {
    const task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      isEvalSupported: false,
      // ERRORS only: don't spam stdout with font/standard-data warnings for the
      // clean, digitally-generated broker PDFs we parse.
      verbosity: 0,
    });
    doc = await withTimeout(task.promise, PARSE_TIMEOUT_MS, 'pdf load');
  } catch (err) {
    if (err instanceof PdfParseError) throw err;
    // pdf.js throws InvalidPDFException / generic errors for non-PDF garbage.
    throw new PdfParseError(
      `not a valid PDF: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (doc.numPages > MAX_PAGES) {
    await doc.destroy();
    throw new PdfParseError(`too many pages: ${doc.numPages}`);
  }

  try {
    const out: PositionedText[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      for (const item of content.items as Array<{
        str?: string;
        transform?: number[];
      }>) {
        if (!item.str?.trim() || !item.transform) continue;
        out.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
          page: p,
        });
      }
    }
    return out;
  } finally {
    // Release the worker/document so we don't leak across many uploads.
    await doc.destroy();
  }
}

/** Race a promise against a timeout, rejecting with PdfParseError on expiry. */
function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new PdfParseError(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() =>
    clearTimeout(timer),
  ) as Promise<T>;
}
