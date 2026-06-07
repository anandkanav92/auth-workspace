// Table reconstruction from positioned PDF text (Task 6.0). pdf.js gives us a
// flat list of text runs with (x, y) coordinates; this module turns that back
// into rows and columns so the broker importers can read a statement table by
// header detection rather than brittle string slicing.
//
// Strategy:
//   1. Group runs into ROWS by their y coordinate (within a tolerance) — runs on
//      the same visual line share a baseline. PDF y grows upward, so we sort
//      rows top-to-bottom (descending y).
//   2. Within a row, sort cells left-to-right by x.
//   3. Find the HEADER row by matching a caller-supplied set of header tokens.
//   4. Snap each data cell to a COLUMN, using x-anchors taken from the header
//      cells. Broker tables right-align numeric columns, so a cell's x wobbles
//      row-to-row; snapping to the nearest header anchor is far more robust than
//      fixed x-bands and handles both the T212 and Revolut layouts.
//   5. Slice data rows between the header and a terminator predicate (e.g. the
//      next section heading), so we never bleed into an adjacent table.

import type { PositionedText } from './safe-pdf';

/** A reconstructed visual row: its cells ordered left-to-right, plus its y/page. */
export type TableRow = { cells: PositionedText[]; y: number; page: number };

const DEFAULT_Y_TOLERANCE = 3; // PDF user-space units; runs within this share a row

/**
 * Group positioned text into visual rows, ordered top-to-bottom across pages.
 * Cells within each row are ordered left-to-right by x.
 */
export function groupIntoRows(
  items: PositionedText[],
  yTolerance = DEFAULT_Y_TOLERANCE,
): TableRow[] {
  // Sort by page, then top-to-bottom (descending y), then left-to-right.
  const sorted = [...items].sort(
    (a, b) => a.page - b.page || b.y - a.y || a.x - b.x,
  );

  const rows: TableRow[] = [];
  for (const item of sorted) {
    const current = rows[rows.length - 1];
    if (
      current &&
      current.page === item.page &&
      Math.abs(current.y - item.y) <= yTolerance
    ) {
      current.cells.push(item);
    } else {
      rows.push({ cells: [item], y: item.y, page: item.page });
    }
  }

  // Cells were pushed in y-then-x order; ensure strict left-to-right per row.
  for (const row of rows) row.cells.sort((a, b) => a.x - b.x);
  return rows;
}

/** Joined, normalised text of a row (single-spaced, trimmed). */
export function rowText(row: TableRow): string {
  return row.cells
    .map((c) => c.str.trim())
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Locate the header row: the first row whose joined text contains every token
 * in `tokens` (case-insensitive). Tokens may be multi-word phrases. Returns the
 * row index, or -1 if no row matches.
 */
export function findHeaderRow(rows: TableRow[], tokens: string[]): number {
  const needles = tokens.map((t) => t.toLowerCase());
  for (let i = 0; i < rows.length; i++) {
    const hay = rowText(rows[i]).toLowerCase();
    if (needles.every((n) => hay.includes(n))) return i;
  }
  return -1;
}

/**
 * Extract the data rows of a table.
 *
 * @param rows        all reconstructed rows (from groupIntoRows).
 * @param headerIndex index of the header row (from findHeaderRow).
 * @param isTerminator predicate marking the first row AFTER the table (e.g. the
 *   next section heading or a totals line). The terminator row is excluded.
 * @returns the rows strictly between the header and the terminator.
 *
 * A header may repeat when a table spans pages; pass `repeatedHeaderText` to skip
 * those repeated header rows instead of treating them as data.
 */
export function sliceTableRows(
  rows: TableRow[],
  headerIndex: number,
  isTerminator: (row: TableRow) => boolean,
  repeatedHeaderText?: string,
): TableRow[] {
  const out: TableRow[] = [];
  const repeated = repeatedHeaderText?.toLowerCase();
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (isTerminator(row)) break;
    if (repeated && rowText(row).toLowerCase().includes(repeated)) continue;
    out.push(row);
  }
  return out;
}

/**
 * Build column x-anchors from a header row. Each header cell's x becomes an
 * anchor; data cells snap to the nearest anchor (see {@link snapToColumns}).
 * The returned array is parallel to the header cells, left-to-right.
 */
export function columnAnchors(header: TableRow): number[] {
  return header.cells.map((c) => c.x);
}

/**
 * Snap a data row's cells to the given column anchors, returning a fixed-length
 * array (parallel to `anchors`) of cell strings. Multiple runs that snap to the
 * same column are concatenated in x-order (defensive — broker numeric cells are
 * single runs, but a stray space-split run won't corrupt the column). Empty
 * columns yield ''.
 */
export function snapToColumns(row: TableRow, anchors: number[]): string[] {
  const buckets: string[][] = anchors.map(() => []);
  for (const cell of row.cells) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < anchors.length; i++) {
      const d = Math.abs(cell.x - anchors[i]);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    buckets[best].push(cell.str.trim());
  }
  return buckets.map((parts) => parts.join(' ').trim());
}
