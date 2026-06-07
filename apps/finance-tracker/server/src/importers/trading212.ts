// Trading 212 PDF importer (Task 6.2). Targets the "Invest account - open
// positions summary" table, which carries cost basis (spike 1, GREEN).
//
// Real table layout (calibrated against the user's statement, pages 3-4):
//   INSTRUMENT · ISIN · INSTRUMENT CURRENCY · QUANTITY · AVERAGE PRICE · PRICE ·
//   RETURN · VALUE · FX RATE · RETURN (EUR) · VALUE (EUR)
//
// We emit cost_basis = QUANTITY × AVERAGE PRICE in the INSTRUMENT CURRENCY.
//
// Two layout gotchas this importer handles:
//   1. A DECOY "Pending orders" sub-table sits just above the open positions and
//      shares the INSTRUMENT/ISIN/INSTRUMENT CURRENCY header tokens. We match the
//      open-positions header by tokens UNIQUE to it (AVERAGE PRICE + FX RATE),
//      never the pending-orders header.
//   2. The table spans pages 3-4 and the column header REPEATS at the top of
//      page 4. sliceTableRows skips the repeated header.

import { extractPositionedText } from './safe-pdf';
import {
  groupIntoRows,
  rowText,
  findHeaderRow,
  sliceTableRows,
  columnAnchors,
  snapToColumns,
  type TableRow,
} from './pdf-table';
import { resolveTicker } from './resolveTicker';
import type { ParsedPosition, ParsedStatement, StatementImporter } from './types';

// Header tokens UNIQUE to the open-positions table (the pending-orders decoy has
// ORDER ID / LIMIT PRICE / STOP PRICE instead of AVERAGE PRICE / FX RATE).
const HEADER_TOKENS = [
  'INSTRUMENT',
  'ISIN',
  'INSTRUMENT CURRENCY',
  'QUANTITY',
  'AVERAGE PRICE',
  'FX RATE',
];
const HEADER_REPEAT = 'INSTRUMENT ISIN INSTRUMENT CURRENCY QUANTITY';

// Column indices within the snapped header anchors (0-based, left-to-right).
const COL = {
  instrument: 0,
  isin: 1,
  currency: 2,
  quantity: 3,
  averagePrice: 4,
} as const;

// A 12-char ISO 6166 ISIN: 2-letter country + 9 alnum + 1 check digit.
const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

export class Trading212PdfImporter implements StatementImporter {
  source = 'trading212' as const;

  detect(text: string): boolean {
    const t = text.toLowerCase();
    return t.includes('trading 212') && t.includes('activity statement');
  }

  async parse(buffer: Buffer): Promise<ParsedStatement> {
    const items = await extractPositionedText(buffer);
    const rows = groupIntoRows(items);

    const headerIndex = findHeaderRow(rows, HEADER_TOKENS);
    if (headerIndex === -1) {
      throw new Error('Trading212: open-positions table header not found');
    }
    const anchors = columnAnchors(rows[headerIndex]);

    // The table ends at the next section ("Invest account - cash breakdown").
    const dataRows = sliceTableRows(
      rows,
      headerIndex,
      (r) => /cash breakdown|executed trades/i.test(rowText(r)),
      HEADER_REPEAT,
    );

    const positions: ParsedPosition[] = [];
    for (const row of dataRows) {
      const pos = await this.parseRow(row, anchors);
      if (pos) positions.push(pos);
    }
    return { source: this.source, positions };
  }

  /** Parse one data row; returns null for non-position rows (sub-headers, notes). */
  private async parseRow(
    row: TableRow,
    anchors: number[],
  ): Promise<ParsedPosition | null> {
    const cells = snapToColumns(row, anchors);
    const isin = cells[COL.isin]?.trim();
    // Only rows with a well-formed ISIN are holdings; everything else (the
    // "Open positions" sub-heading, footer disclaimers) is skipped.
    if (!isin || !ISIN_RE.test(isin)) return null;

    const brokerSymbol = cells[COL.instrument]?.trim();
    const quantity = parseNum(cells[COL.quantity]);
    const averagePrice = parseNum(cells[COL.averagePrice]);
    const currency = cells[COL.currency]?.trim() || undefined;
    if (!brokerSymbol || quantity == null || averagePrice == null) return null;

    const ticker = await resolveTicker(isin, brokerSymbol);
    return {
      ticker,
      isin,
      quantity,
      cost_basis: quantity * averagePrice,
      cost_currency: currency,
    };
  }
}

/** Parse a numeric cell, tolerating thousands separators; null if not a number. */
function parseNum(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,\s]/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export const trading212Importer = new Trading212PdfImporter();
