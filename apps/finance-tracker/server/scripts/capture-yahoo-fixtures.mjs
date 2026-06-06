// One-off live capture of Yahoo Finance v3 quoteSummary responses used as
// committed test fixtures. Run with: node scripts/capture-yahoo-fixtures.mjs
// Requires live network. Not part of the test suite.
import { writeFileSync } from 'node:fs';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const equityModules = ['price', 'summaryDetail', 'assetProfile', 'defaultKeyStatistics', 'quoteType'];

async function capture() {
  // Equity: full assetProfile (sector/country/marketCap populated)
  const aapl = await yf.quoteSummary('AAPL', { modules: equityModules });
  writeFileSync(
    new URL('../tests/fixtures/yahoo-aapl-quoteSummary.json', import.meta.url),
    JSON.stringify(aapl, null, 2),
  );
  console.log('captured AAPL; assetProfile.sector =', aapl?.assetProfile?.sector, '; quoteType =', aapl?.quoteType?.quoteType);

  // ETF profile request: assetProfile sector/country/marketCap come back NULL
  const vwrlProfile = await yf.quoteSummary('VWRL.L', { modules: equityModules });
  writeFileSync(
    new URL('../tests/fixtures/yahoo-vwrl-quoteSummary.json', import.meta.url),
    JSON.stringify(vwrlProfile, null, 2),
  );
  console.log('captured VWRL.L profile; quoteType =', vwrlProfile?.quoteType?.quoteType, '; assetProfile.sector =', vwrlProfile?.assetProfile?.sector);

  // ETF look-through: topHoldings.sectorWeightings
  const vwrlTop = await yf.quoteSummary('VWRL.L', { modules: ['topHoldings'] });
  writeFileSync(
    new URL('../tests/fixtures/yahoo-vwrl-topHoldings.json', import.meta.url),
    JSON.stringify(vwrlTop, null, 2),
  );
  console.log('captured VWRL.L topHoldings; sectorWeightings len =', vwrlTop?.topHoldings?.sectorWeightings?.length);
}

capture().catch((e) => {
  console.error('capture failed:', e);
  process.exit(1);
});
