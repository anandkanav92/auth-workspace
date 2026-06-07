// Revolut PDF importer (Task 6.3). Targets the "USD Portfolio breakdown" table.
// Spike 2 (YELLOW): Revolut statements have NO cost-basis column — only current
// Price/Value — so every emitted position has cost_basis === undefined.
//
// Real table layout (calibrated against the user's statement, page 1):
//   Symbol · Company · ISIN · Quantity · Price · Value · % of Portfolio
//
// Layout gotchas this importer handles:
//   1. The table is immediately followed by a "USD Transactions" history table
//      (hundreds of rows). We STOP at the "Positions Value" totals line so we
//      never bleed into transactions.
//   2. "Revolut" only appears in the transaction descriptions / issuing-entity
//      line, not the page-1 header — so detect() matches against the FULL
//      concatenated document text (which the upload route passes in).

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

const HEADER_TOKENS = ['Symbol', 'Company', 'ISIN', 'Quantity', 'Price', 'Value'];

// Column indices within the snapped header anchors (0-based, left-to-right).
const COL = {
  symbol: 0,
  company: 1,
  isin: 2,
  quantity: 3,
} as const;

const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

export class RevolutPdfImporter implements StatementImporter {
  source = 'revolut' as const;

  detect(text: string): boolean {
    const t = text.toLowerCase();
    return t.includes('revolut') && t.includes('account statement');
  }

  async parse(buffer: Buffer): Promise<ParsedStatement> {
    const items = await extractPositionedText(buffer);
    const rows = groupIntoRows(items);

    const headerIndex = findHeaderRow(rows, HEADER_TOKENS);
    if (headerIndex === -1) {
      throw new Error('Revolut: portfolio-breakdown table header not found');
    }
    const anchors = columnAnchors(rows[headerIndex]);

    // Stop at the "Positions Value" totals line — the boundary before the
    // transactions table (spike 2).
    const dataRows = sliceTableRows(rows, headerIndex, (r) =>
      /positions value/i.test(rowText(r)),
    );

    const positions: ParsedPosition[] = [];
    for (const row of dataRows) {
      const pos = await this.parseRow(row, anchors);
      if (pos) positions.push(pos);
    }
    return { source: this.source, positions };
  }

  /** Parse one data row; returns null for non-position rows. */
  private async parseRow(
    row: TableRow,
    anchors: number[],
  ): Promise<ParsedPosition | null> {
    const cells = snapToColumns(row, anchors);
    const isin = cells[COL.isin]?.trim();
    if (!isin || !ISIN_RE.test(isin)) return null;

    const symbol = cells[COL.symbol]?.trim();
    const quantity = parseNum(cells[COL.quantity]);
    if (!symbol || quantity == null) return null;

    // Symbol is verified against the ISIN: resolveTicker maps the ISIN to the
    // canonical ticker (falling back to the broker symbol if unresolved).
    const ticker = await resolveTicker(isin, symbol);
    return {
      ticker,
      isin,
      quantity,
      cost_basis: undefined, // spike 2: Revolut has no cost basis
      cost_currency: undefined,
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

export const revolutImporter = new RevolutPdfImporter();
