// Statement import endpoints (Tasks 6.4 + 6.5). Two-step upload→commit so the
// user reviews a diff before any holdings are touched:
//
//   POST /api/import/upload  (multipart: file + accountId) → preview
//     1. sha256(file)
//     2. dedup: 409 if this hash already imported for this account
//     3. detect importer from the statement text (+ filename hint)
//     4. parse → positions[]
//     5. diff vs the account's current holdings
//     6. synchronously enrich NEW tickers (profile + price) so the preview shows
//        names/prices
//     7. cache the parsed result (10-min TTL) → return { previewId, diff, summary }
//
//   POST /api/import/commit  ({ previewId }) → snapshot-replace (ATOMIC)
//     1. load preview (404 "preview expired or not found" if gone)
//     2. in ONE PocketBase batch transaction (all-or-nothing — C1 fix):
//        - delete ALL holdings for (user, account)
//        - insert the statement's holdings
//        - write the imports row (hash, filename, row_count, status)
//     If any step fails the whole batch rolls back, so a mid-insert failure can
//     no longer leave the account wiped (see db/importCommit.ts).
//
// SECURITY: both routes are behind authMiddleware + rateLimit and assert the
// target account belongs to c.var.pbUserId via requireOwned (the admin repos
// bypass PocketBase rules — see _helpers.ts).

import { createHash } from 'node:crypto';
import { Hono } from 'hono';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import { accountsRepo } from '../db/accounts';
import { holdingsRepo } from '../db/holdings';
import { importsRepo } from '../db/imports';
import { commitSnapshotReplace } from '../db/importCommit';
import { symbolProfilesRepo } from '../db/symbolProfiles';
import { priceCacheRepo } from '../db/priceCache';
import { extractPositionedText } from '../importers/safe-pdf';
import { PdfParseError } from '../importers/safe-pdf';
import { detectImporter } from '../importers/registry';
import { YahooPriceProvider } from '../providers/yahoo';
import type { PriceProvider } from '../providers/types';
import { computeDiff, summariseDiff } from './importDiff';
import {
  putPreview,
  getPreview,
  deletePreview,
  type PreviewRecord,
  type DiffEntry,
} from './importPreview';
import { parseBody, readJson, requireOwned } from './_helpers';
import type { HoldingCreate, Import, SymbolProfileCreate } from '../db/schemas';

type Vars = { Variables: { uid: string; email: string; pbUserId: string } };

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // mirror the safe-pdf cap
const provider: PriceProvider = new YahooPriceProvider();

const commitSchema = z.object({ previewId: z.string().min(1) });

export const importRoutes = new Hono<Vars>()
  // POST /api/import/upload — parse + diff, return a preview (no writes to holdings).
  .post('/upload', async (c) => {
    const pbUserId = c.var.pbUserId;

    const form = await c.req.parseBody().catch(() => {
      throw new HTTPException(400, { message: 'expected multipart/form-data' });
    });
    const file = form['file'];
    const accountId = form['accountId'];
    if (!(file instanceof File)) {
      throw new HTTPException(400, { message: 'file is required' });
    }
    if (typeof accountId !== 'string' || accountId.length === 0) {
      throw new HTTPException(400, { message: 'accountId is required' });
    }

    // Ownership: the account must belong to the caller (else IDOR via accountId).
    await requireOwned(accountsRepo, accountId, pbUserId);

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_UPLOAD_BYTES) {
      throw new HTTPException(413, { message: 'file too large' });
    }
    const fileHash = createHash('sha256').update(buffer).digest('hex');

    // Dedup: re-importing the same file to the same account is a no-op → 409.
    const existing = await importsRepo.findByHash(pbUserId, accountId, fileHash);
    if (existing) {
      return c.json(
        {
          error: 'already_imported',
          importedAt: existing.created,
          filename: existing.filename,
        },
        409,
      );
    }

    // Extract text once, pick the importer, parse.
    let items;
    try {
      items = await extractPositionedText(buffer);
    } catch (err) {
      if (err instanceof PdfParseError) {
        throw new HTTPException(400, { message: err.message });
      }
      throw err;
    }
    const fullText = items.map((i) => i.str).join(' ');
    const importer = detectImporter(fullText);
    if (!importer) {
      throw new HTTPException(422, {
        message: 'unrecognised statement (not Trading 212 or Revolut)',
      });
    }

    let parsed;
    try {
      parsed = await importer.parse(buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'parse failed';
      throw new HTTPException(422, { message: msg });
    }
    if (parsed.positions.length === 0) {
      throw new HTTPException(422, { message: 'no positions found in statement' });
    }

    // Diff vs current holdings of this account.
    const current = await holdingsRepo.listForUser(pbUserId, {
      account: accountId,
      openOnly: true,
    });
    const knownTickers = await knownTickerSet(parsed.positions.map((p) => p.ticker));
    const diff = computeDiff(parsed.positions, current, knownTickers);

    // Synchronously enrich tickers that have no symbol_profiles row yet, so the
    // preview can show names + prices. Failures are non-fatal (best effort).
    await enrichNewTickers(diff);

    const previewId = putPreview({
      pbUserId,
      account: accountId,
      source: parsed.source,
      filename: file.name || 'statement.pdf',
      fileHash,
      positions: parsed.positions,
      diff,
    });

    return c.json({ previewId, diff, summary: summariseDiff(diff) });
  })

  // POST /api/import/commit — snapshot-replace the account's holdings from a preview.
  .post('/commit', async (c) => {
    const pbUserId = c.var.pbUserId;
    const { previewId } = parseBody(commitSchema, await readJson(c));

    const preview = getPreview(previewId);
    // I13: distinct "expired or not found" message so the UI prompts re-upload.
    if (!preview) {
      throw new HTTPException(404, { message: 'preview expired or not found' });
    }
    // A preview is bound to its creator; never let user A commit user B's.
    if (preview.pbUserId !== pbUserId) {
      throw new HTTPException(404, { message: 'preview expired or not found' });
    }
    // Re-assert account ownership at commit time (the account could have been
    // deleted/reassigned between upload and commit).
    await requireOwned(accountsRepo, preview.account, pbUserId);

    // Atomic snapshot-replace: delete prior holdings + insert the new positions
    // + write the imports row, all in ONE batch transaction. On any failure the
    // whole thing rolls back (no wipe). See db/importCommit.ts (C1 fix).
    const importRow = await commitPreview(preview);
    deletePreview(previewId);

    return c.json({
      ok: true,
      importId: importRow.id,
      rowCount: preview.positions.length,
    });
  });

/**
 * Atomic snapshot-replace: in a single PocketBase batch transaction, delete
 * every holding for (user, account), insert the statement's positions, and
 * write the imports row. Closed (qty 0) holdings are included in the delete so a
 * re-import starts from a clean slate. Returns the created imports row.
 *
 * All-or-nothing (C1 fix): if any request in the batch fails, PocketBase rolls
 * back the entire batch — the account's prior holdings are preserved and no
 * imports row is written.
 */
async function commitPreview(preview: PreviewRecord): Promise<Import> {
  const existing = await holdingsRepo.listForUser(preview.pbUserId, {
    account: preview.account,
  });

  // NOTE for the P&L tiles (M11): PocketBase's NumberField coerces a written
  // null cost_basis to 0 on read, so 0 is NOT a reliable "no cost data" signal.
  // The reliable marker is the (TextField) cost_currency staying EMPTY —
  // Revolut positions have no cost_currency. Tiles must exclude positions with
  // an empty cost_currency from return aggregation (spike 2).
  const holdings: HoldingCreate[] = preview.positions.map((pos) => ({
    user: preview.pbUserId,
    account: preview.account,
    ticker: pos.ticker,
    isin: pos.isin,
    quantity: pos.quantity,
    cost_basis: pos.cost_basis ?? null,
    cost_currency: pos.cost_currency ?? null,
    source: preview.source,
  }));

  return commitSnapshotReplace({
    existing,
    holdings,
    importRow: {
      user: preview.pbUserId,
      account: preview.account,
      source: preview.source,
      filename: preview.filename,
      file_hash: preview.fileHash,
      row_count: preview.positions.length,
      status: 'success',
    },
  });
}

/** Which of `tickers` already have a symbol_profiles row (so they're not "new"). */
async function knownTickerSet(tickers: string[]): Promise<Set<string>> {
  const known = new Set<string>();
  await Promise.all(
    [...new Set(tickers)].map(async (t) => {
      const profile = await symbolProfilesRepo.get(t).catch(() => null);
      if (profile) known.add(t);
    }),
  );
  return known;
}

/**
 * For each NEW ticker in the diff, synchronously fetch its profile + price and
 * cache them. Best-effort: a failed fetch leaves the ticker unenriched but does
 * not fail the upload (the preview just won't show a name/price for it).
 */
async function enrichNewTickers(diff: DiffEntry[]): Promise<void> {
  // Skip 'removed' entries: a holding the statement dropped is not a ticker we
  // need to enrich (it carries no new profile/price to fetch).
  const todo = diff.filter((d) => d.isNewTicker && d.status !== 'removed');
  await Promise.all(
    todo.map(async (d) => {
      const [profile, quote] = await Promise.all([
        provider.profile(d.ticker).catch(() => null),
        provider.quote(d.ticker).catch(() => null),
      ]);
      if (profile) {
        const row: SymbolProfileCreate = {
          ticker: profile.ticker,
          isin: profile.isin ?? d.isin,
          name: profile.name,
          exchange: profile.exchange,
          asset_type: profile.assetType,
          listing_currency: profile.listingCurrency,
          sector: profile.sector,
          industry: profile.industry,
          country: profile.country,
          market_cap: profile.marketCap,
          pe_ratio: profile.peRatio,
          beta: profile.beta,
          dividend_yield: profile.dividendYield,
          sector_weightings: profile.sectorWeightings ?? null,
          data_source: profile.source ?? 'yahoo', // true provenance from the chain
          last_refreshed_at: new Date().toISOString(),
        };
        await symbolProfilesRepo.upsert(row).catch(() => undefined);
      }
      if (quote) {
        await priceCacheRepo
          .upsert({
            ticker: quote.ticker,
            price: quote.price,
            currency: quote.currency,
            as_of: quote.asOf.toISOString(),
            last_fetched_at: new Date().toISOString(),
            data_source: quote.source ?? 'yahoo', // true provenance from the chain
          })
          .catch(() => undefined);
      }
    }),
  );
}
