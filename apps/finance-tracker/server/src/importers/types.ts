// StatementImporter interface (Task 6.1, design §6). Each broker importer turns
// an uploaded PDF buffer into a normalised ParsedStatement. The upload route
// picks an importer via detect(), then calls parse().
//
// IMPORTANT (spike 2): cost_basis + cost_currency are OPTIONAL. Trading 212's
// "open positions" table carries cost basis; Revolut's "portfolio breakdown"
// does NOT — Revolut positions parse with cost_basis === undefined, and the P&L
// tiles render "—" for them. ISIN is the canonical join key (both brokers always
// populate it) and is therefore required on every parsed position.

import type { StatementSource } from './source';

/** One holding line parsed from a statement, before ISIN→ticker resolution
 * persists profiles. `ticker` is the broker's own symbol; the upload route
 * resolves/normalises it against symbol_profiles via the ISIN. */
export interface ParsedPosition {
  /** Broker symbol as printed in the statement (e.g. "AAPL", "SGLN"). */
  ticker: string;
  /** ISO 6166 identifier — always present for both brokers (spikes 1 & 2). */
  isin: string;
  /** Share/unit count held. */
  quantity: number;
  /** Total cost (quantity × average price). Undefined when the broker has no
   * cost data (Revolut). */
  cost_basis?: number;
  /** Currency of cost_basis (the instrument currency). Undefined with cost_basis. */
  cost_currency?: string;
}

/** Normalised result of parsing one statement. */
export interface ParsedStatement {
  /** Which broker this came from — drives the imports row + account source. */
  source: StatementSource;
  positions: ParsedPosition[];
}

/** A pluggable per-broker statement importer (Strategy pattern). */
export interface StatementImporter {
  /** Which broker this importer handles. */
  source: StatementSource;
  /**
   * True if `text` (the full concatenated statement text) looks like this
   * broker's statement. Cheap marker matching — the upload route tries each
   * importer's detect() to pick one.
   */
  detect(text: string): boolean;
  /** Parse the statement PDF buffer into normalised positions. */
  parse(buffer: Buffer): Promise<ParsedStatement>;
}
