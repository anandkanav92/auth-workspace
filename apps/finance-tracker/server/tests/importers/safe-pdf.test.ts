import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extractPositionedText, PdfParseError } from '../../src/importers/safe-pdf';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, '..', 'fixtures');

describe('safe-pdf harness', () => {
  it('rejects an oversize buffer before parsing', async () => {
    const huge = Buffer.alloc(16 * 1024 * 1024); // > 15 MB cap
    await expect(extractPositionedText(huge)).rejects.toBeInstanceOf(PdfParseError);
    await expect(extractPositionedText(huge)).rejects.toThrow(/too large/);
  });

  it('rejects non-PDF garbage with a PdfParseError (not a generic 500)', async () => {
    const garbage = Buffer.from('this is definitely not a pdf file', 'utf8');
    await expect(extractPositionedText(garbage)).rejects.toBeInstanceOf(PdfParseError);
  });

  it('extracts positioned text from a real-layout fixture with sane coords', async () => {
    const buf = readFileSync(join(FIXTURES, 't212-synthetic.pdf'));
    const items = await extractPositionedText(buf);

    expect(items.length).toBeGreaterThan(0);
    // Every item carries a non-blank string, a 1-based page, finite coordinates.
    for (const it of items) {
      expect(it.str.trim().length).toBeGreaterThan(0);
      expect(it.page).toBeGreaterThanOrEqual(1);
      expect(Number.isFinite(it.x)).toBe(true);
      expect(Number.isFinite(it.y)).toBe(true);
    }
    // A known marker is present at its calibrated location.
    const heading = items.find((i) => i.str.includes('open positions summary'));
    expect(heading).toBeDefined();
    expect(heading!.page).toBe(1);
  });
});
