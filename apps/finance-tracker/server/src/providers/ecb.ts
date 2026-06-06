// Reviewer fix N8: use fast-xml-parser instead of a fragile regex.
// Real ECB XML shape: gesmes:Envelope > Cube > Cube[time] > Cube[currency,rate].
import { XMLParser } from 'fast-xml-parser';
import type { FxProvider } from './types';

type RateCube = { currency?: string; rate?: string };

export class EcbFxProvider implements FxProvider {
  name = 'ecb' as const;
  private parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

  async latest(): Promise<Record<string, number>> {
    const r = await fetch('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml');
    if (!r.ok) throw new Error(`ECB FX fetch failed: ${r.status}`);
    const xml = await r.text();
    const doc = this.parser.parse(xml);
    const cubes = doc?.['gesmes:Envelope']?.Cube?.Cube?.Cube ?? [];
    const list: RateCube[] = Array.isArray(cubes) ? cubes : [cubes];
    const rates: Record<string, number> = { EUR: 1 };
    for (const c of list) {
      if (c.currency && c.rate) rates[c.currency] = parseFloat(c.rate);
    }
    return rates;
  }
}
