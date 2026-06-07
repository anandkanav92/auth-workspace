import { describe, it, expect } from 'vitest';
import type { PositionedText } from '../../src/importers/safe-pdf';
import {
  groupIntoRows,
  rowText,
  findHeaderRow,
  sliceTableRows,
  columnAnchors,
  snapToColumns,
} from '../../src/importers/pdf-table';

// A tiny synthetic two-column table:
//   header:  [10] NAME      [100] QTY
//   row 1:   [10] AAPL      [110] 3      (qty x wobbles right — right-aligned)
//   row 2:   [10] MSFT      [108] 12
//   footer:  [10] TOTAL
function p(str: string, x: number, y: number, page = 1): PositionedText {
  return { str, x, y, page };
}

const items: PositionedText[] = [
  p('NAME', 10, 200),
  p('QTY', 100, 200),
  p('AAPL', 10, 184),
  p('3', 110, 184),
  p('MSFT', 10, 168),
  p('12', 108, 168),
  p('TOTAL', 10, 152),
];

describe('pdf-table reconstruction', () => {
  it('groups runs into rows by y and orders cells left-to-right', () => {
    const rows = groupIntoRows(items);
    expect(rows).toHaveLength(4); // header + 2 data + footer
    expect(rows[0].cells.map((c) => c.str)).toEqual(['NAME', 'QTY']);
    expect(rows[1].cells.map((c) => c.str)).toEqual(['AAPL', '3']);
    // Top-to-bottom ordering (descending y).
    expect(rows[0].y).toBeGreaterThan(rows[1].y);
  });

  it('keeps runs within the y-tolerance on the same row', () => {
    const wobbly = [p('A', 10, 100), p('B', 50, 102)]; // 2px apart
    const rows = groupIntoRows(wobbly, 3);
    expect(rows).toHaveLength(1);
    expect(rows[0].cells.map((c) => c.str)).toEqual(['A', 'B']);
  });

  it('finds the header row by required tokens (case-insensitive)', () => {
    const rows = groupIntoRows(items);
    expect(findHeaderRow(rows, ['NAME', 'QTY'])).toBe(0);
    expect(findHeaderRow(rows, ['name', 'qty'])).toBe(0);
    expect(findHeaderRow(rows, ['NOPE'])).toBe(-1);
  });

  it('slices data rows between header and a terminator', () => {
    const rows = groupIntoRows(items);
    const header = findHeaderRow(rows, ['NAME', 'QTY']);
    const data = sliceTableRows(rows, header, (r) =>
      rowText(r).startsWith('TOTAL'),
    );
    expect(data.map((r) => r.cells[0].str)).toEqual(['AAPL', 'MSFT']);
  });

  it('snaps right-aligned numeric cells to header column anchors', () => {
    const rows = groupIntoRows(items);
    const header = rows[0];
    const anchors = columnAnchors(header); // [10, 100]
    const data = sliceTableRows(rows, 0, (r) => rowText(r).startsWith('TOTAL'));
    // qty cell x (110/108) is closer to the QTY anchor (100) than NAME (10).
    expect(snapToColumns(data[0], anchors)).toEqual(['AAPL', '3']);
    expect(snapToColumns(data[1], anchors)).toEqual(['MSFT', '12']);
  });

  it('skips repeated header rows when a table spans pages', () => {
    const multi: PositionedText[] = [
      p('NAME', 10, 200, 1),
      p('QTY', 100, 200, 1),
      p('AAPL', 10, 184, 1),
      p('3', 110, 184, 1),
      // page 2 repeats the header at the top
      p('NAME', 10, 200, 2),
      p('QTY', 100, 200, 2),
      p('MSFT', 10, 184, 2),
      p('12', 108, 184, 2),
      p('TOTAL', 10, 168, 2),
    ];
    const rows = groupIntoRows(multi);
    const header = findHeaderRow(rows, ['NAME', 'QTY']);
    const data = sliceTableRows(
      rows,
      header,
      (r) => rowText(r).startsWith('TOTAL'),
      'NAME QTY',
    );
    expect(data.map((r) => r.cells[0].str)).toEqual(['AAPL', 'MSFT']);
  });
});
