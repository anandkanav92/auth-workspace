import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EcbFxProvider } from '../../src/providers/ecb';

// Live-captured from https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml.
// Real shape: gesmes:Envelope > Cube > Cube[time] > Cube[currency,rate].
const fixtureXml = readFileSync(
  fileURLToPath(new URL('../fixtures/ecb-eurofxref-daily.xml', import.meta.url)),
  'utf8',
);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('EcbFxProvider', () => {
  it('parses the daily XML into EUR-based rates', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => fixtureXml,
    } as Response);

    const provider = new EcbFxProvider();
    const rates = await provider.latest();

    expect(rates.EUR).toBe(1);
    expect(rates.USD).toBeGreaterThan(0);
    expect(rates.GBP).toBeGreaterThan(0);
    expect(rates.CHF).toBeGreaterThan(0);
    expect(rates.JPY).toBeGreaterThan(0);
    // values are parsed as numbers, not strings
    expect(typeof rates.USD).toBe('number');
  });

  it('throws when the ECB endpoint responds non-ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => '',
    } as Response);

    const provider = new EcbFxProvider();
    await expect(provider.latest()).rejects.toThrow(/503/);
  });
});
