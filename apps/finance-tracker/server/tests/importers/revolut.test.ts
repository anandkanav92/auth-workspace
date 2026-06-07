import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

vi.mock('../../src/importers/resolveTicker', () => ({
  resolveTicker: vi.fn(async (_isin: string, brokerSymbol: string) => brokerSymbol),
}));

import { RevolutPdfImporter } from '../../src/importers/revolut';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, '..', 'fixtures', 'revolut-synthetic.pdf');

describe('RevolutPdfImporter', () => {
  const importer = new RevolutPdfImporter();

  it('detects a Revolut account statement (brand may appear anywhere)', () => {
    expect(importer.detect('... Revolut Securities Europe UAB ... Account Statement')).toBe(true);
    expect(importer.detect('Trading 212 Activity statement')).toBe(false);
  });

  it('parses the portfolio breakdown with cost_basis undefined', async () => {
    const buf = readFileSync(FIXTURE);
    const { source, positions } = await importer.parse(buf);

    expect(source).toBe('revolut');
    expect(positions).toHaveLength(5);

    const meta = positions.find((p) => p.ticker === 'META');
    expect(meta).toBeDefined();
    expect(meta!.isin).toBe('US30303M1027');
    expect(meta!.quantity).toBeCloseTo(2.48828342, 6);
    expect(meta!.cost_basis).toBeUndefined();
    expect(meta!.cost_currency).toBeUndefined();

    // Revolut invariant: NO position carries a cost basis.
    for (const p of positions) {
      expect(p.cost_basis).toBeUndefined();
    }
  });

  it('stops at "Positions Value" and does not bleed into the transactions table', async () => {
    const buf = readFileSync(FIXTURE);
    const { positions } = await importer.parse(buf);
    // The decoy transaction row (XOM "Trade - Market") sits below "Positions
    // Value"; it must NOT appear as a holding.
    expect(positions.find((p) => p.ticker === 'XOM')).toBeUndefined();
    // Last real holding is NKE — nothing after it.
    expect(positions.map((p) => p.ticker)).toEqual([
      'META',
      'NVDA',
      'AMZN',
      'CLNE',
      'NKE',
    ]);
  });
});
