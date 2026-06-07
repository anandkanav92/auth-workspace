import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { TileGrid } from "@/components/layout/TileGrid";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PHASE_1_TILES } from "@/tiles/registry";
import type {
  Account,
  FxRates,
  Holding,
  PriceQuote,
  SymbolProfile,
} from "@/tiles/types";

/**
 * DEV-ONLY visual-QA gallery for the six analytics tiles.
 *
 * Unlike the BFF-backed dashboard, this surface seeds a *fresh* QueryClient with
 * realistic fixtures for every key `usePortfolioData` reads, then renders the
 * REAL tile components (`PHASE_1_TILES`) in the REAL `TileGrid`. Because the
 * cache is pre-populated and `staleTime: Infinity` keeps it fresh, the tiles
 * resolve instantly off the seeded data — no `/api/*` request ever fires, so the
 * gallery works with no Firebase sign-in and no running BFF.
 *
 * The five keys + shapes match `usePortfolioData` exactly:
 *   ["holdings"]  -> Holding[]
 *   ["accounts"]  -> Account[]
 *   ["prices"]    -> PriceQuote[]
 *   ["profiles"]  -> SymbolProfile[]
 *   ["fx"]        -> FxRates | null   (the `{ rates }` object)
 *
 * Not part of the shipped app — reachable at /dev/tiles, outside the AuthGate.
 */

// --- Fixture dataset --------------------------------------------------------
//
// Two accounts modelling the two real broker shapes (spike 2):
//   - Trading 212: positions carry a real cost basis (non-empty cost_currency).
//   - Revolut:     positions carry NO cost basis (null cost_currency) — these
//                  drop out of the return aggregates and feed the "costless"
//                  footnote / neutral-grey treemap boxes.
//
// Ten holdings across a mix of US tech stocks (USD), one EUR-listed stock
// (ASML), and one global ETF (VWRL, with sector_weightings driving the
// Allocation look-through). The numbers are sized so the donut, treemap, and
// diversification all read as a realistic, moderately-concentrated book.

const ACCOUNT_T212 = "acc_t212";
const ACCOUNT_REVOLUT = "acc_revolut";

const accounts: Account[] = [
  {
    id: ACCOUNT_T212,
    source: "trading212",
    label: "Trading 212",
    currency: "EUR",
  },
  {
    id: ACCOUNT_REVOLUT,
    source: "revolut",
    label: "Revolut",
    currency: "EUR",
  },
];

const holdings: Holding[] = [
  // --- Trading 212: full cost basis (cost_basis is a TOTAL in cost_currency) --
  {
    id: "h_aapl",
    account: ACCOUNT_T212,
    ticker: "AAPL",
    isin: "US0378331005",
    quantity: 60,
    cost_basis: 9000, // 60 @ ~$150
    cost_currency: "USD",
    source: "trading212",
  },
  {
    id: "h_msft",
    account: ACCOUNT_T212,
    ticker: "MSFT",
    isin: "US5949181045",
    quantity: 30,
    cost_basis: 9600, // 30 @ ~$320
    cost_currency: "USD",
    source: "trading212",
  },
  {
    id: "h_nvda",
    account: ACCOUNT_T212,
    ticker: "NVDA",
    isin: "US67066G1040",
    quantity: 120,
    cost_basis: 7200, // 120 @ ~$60 (pre-run-up) — large unrealised gain
    cost_currency: "USD",
    source: "trading212",
  },
  {
    id: "h_asml",
    account: ACCOUNT_T212,
    ticker: "ASML",
    isin: "NL0010273215",
    quantity: 12,
    cost_basis: 7800, // 12 @ ~€650, already EUR
    cost_currency: "EUR",
    source: "trading212",
  },
  {
    id: "h_vwrl",
    account: ACCOUNT_T212,
    ticker: "VWRL",
    isin: "IE00B3RBWM25",
    quantity: 80,
    cost_basis: 8000, // 80 @ ~$100
    cost_currency: "USD",
    source: "trading212",
  },
  {
    id: "h_intc",
    account: ACCOUNT_T212,
    ticker: "INTC",
    isin: "US4581401001",
    quantity: 150,
    cost_basis: 6750, // 150 @ ~$45 — now under water (loss-making P/E too)
    cost_currency: "USD",
    source: "trading212",
  },
  // --- Revolut: NO cost basis (null cost_currency → excluded from returns) ----
  {
    id: "h_tsla",
    account: ACCOUNT_REVOLUT,
    ticker: "TSLA",
    isin: "US88160R1014",
    quantity: 25,
    cost_basis: null,
    cost_currency: null,
    source: "revolut",
  },
  {
    id: "h_amzn",
    account: ACCOUNT_REVOLUT,
    ticker: "AMZN",
    isin: "US0231351067",
    quantity: 40,
    cost_basis: null,
    cost_currency: null,
    source: "revolut",
  },
  {
    id: "h_googl",
    account: ACCOUNT_REVOLUT,
    ticker: "GOOGL",
    isin: "US02079K3059",
    quantity: 35,
    cost_basis: null,
    cost_currency: null,
    source: "revolut",
  },
];

const prices: PriceQuote[] = [
  { ticker: "AAPL", price: 195.5, currency: "USD" },
  { ticker: "MSFT", price: 430.2, currency: "USD" },
  { ticker: "NVDA", price: 122.4, currency: "USD" }, // big gain vs ~$60 cost
  { ticker: "ASML", price: 720.0, currency: "EUR" },
  { ticker: "VWRL", price: 112.3, currency: "USD" },
  { ticker: "INTC", price: 31.8, currency: "USD" }, // loss vs ~$45 cost
  { ticker: "TSLA", price: 248.7, currency: "USD" },
  { ticker: "AMZN", price: 186.4, currency: "USD" },
  { ticker: "GOOGL", price: 174.9, currency: "USD" },
];

const profiles: SymbolProfile[] = [
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    asset_type: "stock",
    sector: "Technology",
    country: "United States",
    market_cap: 3_000_000_000_000,
    pe_ratio: 29.4,
    beta: 1.24,
    dividend_yield: 0.005,
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corp.",
    asset_type: "stock",
    sector: "Technology",
    country: "United States",
    market_cap: 3_200_000_000_000,
    pe_ratio: 35.1,
    beta: 0.91,
    dividend_yield: 0.0072,
  },
  {
    ticker: "NVDA",
    name: "NVIDIA Corp.",
    asset_type: "stock",
    sector: "Technology",
    country: "United States",
    market_cap: 3_100_000_000_000,
    pe_ratio: 55.0,
    beta: 1.68,
    dividend_yield: 0.0003,
  },
  {
    ticker: "ASML",
    name: "ASML Holding N.V.",
    asset_type: "stock",
    sector: "Technology",
    country: "Netherlands",
    market_cap: 320_000_000_000,
    pe_ratio: 41.2,
    beta: 1.35,
    dividend_yield: 0.0095,
  },
  {
    ticker: "VWRL",
    name: "Vanguard FTSE All-World ETF",
    asset_type: "etf",
    // ETFs lack a single sector/country — Allocation does look-through via
    // sector_weightings, and routes the ETF to a "Multiple/Diversified" geo
    // bucket. Weights are 0..1 (they need not sum to exactly 1 — the math
    // normalises defensively).
    sector_weightings: {
      Technology: 0.24,
      Financials: 0.16,
      "Consumer Discretionary": 0.12,
      "Health Care": 0.11,
      Industrials: 0.1,
      "Communication Services": 0.08,
      "Consumer Staples": 0.06,
      Energy: 0.05,
      Materials: 0.04,
      Utilities: 0.02,
      "Real Estate": 0.02,
    },
    beta: 1.0,
    dividend_yield: 0.0188,
  },
  {
    ticker: "INTC",
    name: "Intel Corp.",
    asset_type: "stock",
    sector: "Technology",
    country: "United States",
    market_cap: 135_000_000_000,
    // Negative P/E (loss-making) — exercises the Quality I11 exclusion banner.
    pe_ratio: -18.5,
    beta: 1.05,
    dividend_yield: 0.015,
  },
  {
    ticker: "TSLA",
    name: "Tesla Inc.",
    asset_type: "stock",
    sector: "Consumer Discretionary",
    country: "United States",
    market_cap: 800_000_000_000,
    pe_ratio: 62.3,
    beta: 2.01,
    dividend_yield: 0,
  },
  {
    ticker: "AMZN",
    name: "Amazon.com Inc.",
    asset_type: "stock",
    sector: "Consumer Discretionary",
    country: "United States",
    market_cap: 1_900_000_000_000,
    pe_ratio: 44.0,
    beta: 1.15,
    dividend_yield: 0,
  },
  {
    ticker: "GOOGL",
    name: "Alphabet Inc.",
    asset_type: "stock",
    sector: "Communication Services",
    country: "United States",
    market_cap: 2_100_000_000_000,
    pe_ratio: 24.8,
    beta: 1.03,
    dividend_yield: 0.004,
  },
];

// ECB EUR-base rates: rates[CCY] = units of CCY per 1 EUR. EUR itself is 1.
// USD here means ~1.08 USD = 1 EUR; buildPortfolio divides by this to value
// USD positions in EUR. GBP included for realism (no GBP positions use it).
const fx: FxRates = {
  rates: {
    USD: 1.08,
    GBP: 0.85,
    CHF: 0.95,
  },
};

// --- Seeded QueryClient -----------------------------------------------------

/**
 * Build a fresh client pre-seeded with the fixtures. `staleTime: Infinity` (and
 * an effectively-infinite `gcTime`) ensures the seeded entries are treated as
 * fresh and are never garbage-collected, so `usePortfolioData`'s queries
 * resolve from cache and never invoke their `queryFn` (no network).
 */
function buildSeededClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: Infinity,
        gcTime: Infinity,
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });

  client.setQueryData<Holding[]>(["holdings"], holdings);
  client.setQueryData<Account[]>(["accounts"], accounts);
  client.setQueryData<PriceQuote[]>(["prices"], prices);
  client.setQueryData<SymbolProfile[]>(["profiles"], profiles);
  client.setQueryData<FxRates | null>(["fx"], fx);

  return client;
}

// --- Gallery panels ---------------------------------------------------------

/** The real tile grid, rendered from the registry exactly as the dashboard does. */
function TilesGallery() {
  return (
    <TileGrid>
      {PHASE_1_TILES.map(({ id, component: Tile, fullWidth }) => (
        <div
          key={id}
          className={fullWidth ? "md:col-span-2 xl:col-span-3" : undefined}
        >
          <Tile accountIds="all" />
        </div>
      ))}
    </TileGrid>
  );
}

interface PanelProps {
  theme: "light" | "dark";
}

/**
 * One forced-theme panel. Setting `data-theme` on the wrapper re-binds the CSS
 * design tokens for the subtree (the tokens are declared on `:root` /
 * `[data-theme="dark"]`), giving a genuine light/dark comparison on one screen
 * without touching the global ThemeProvider — same trick as LayoutPreview.
 */
function Panel({ theme }: PanelProps) {
  return (
    <div className="flex-1 overflow-hidden rounded-2xl border border-border">
      <div className="border-b border-border bg-surface px-4 py-2 text-sm font-medium capitalize text-fg">
        {theme}
      </div>
      <div data-theme={theme} className="bg-bg p-4 text-fg">
        <TilesGallery />
      </div>
    </div>
  );
}

export function TilesPreview() {
  // One client for the whole preview; seeded once at module render. A fresh
  // client (not the app's shared one) keeps this surface fully self-contained.
  const queryClient = buildSeededClient();

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-bg p-4 text-fg">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Tiles preview</h1>
            <p className="text-sm text-muted">
              Dev-only visual QA · all 6 analytics tiles · fixture data, no BFF
            </p>
          </div>
          <ThemeToggle />
        </header>

        <div className="flex flex-col gap-4 xl:flex-row">
          <Panel theme="light" />
          <Panel theme="dark" />
        </div>
      </div>
    </QueryClientProvider>
  );
}
