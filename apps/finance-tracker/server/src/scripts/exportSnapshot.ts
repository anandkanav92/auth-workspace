// CLI: export a point-in-time portfolio snapshot for the Investment Research Lab.
//
//   pnpm --filter finance-tracker-server export:snapshot -- --user <id|email> [--out <path>]
//
// Produces the schemaVersion-1 contract (see export/portfolioSnapshot.ts) by
// reusing the existing repos (holdings / price_cache / symbol_profiles / fx_rates)
// — no duplicate fetching. Writes atomically (tmp + rename). Default output is the
// lab's gitignored input path. A launchd job calls this weekly.
//
// IMPORTANT load order: lib/pb.ts reads PB env vars at module load (and throws if
// absent), so we load .env and validate env BEFORE dynamically importing any repo.
// The pure builder has no env dependency and is imported statically.

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildSnapshot } from '../export/portfolioSnapshot';

const DEFAULT_OUT = '~/ai_projects/investment_research_lab/input/portfolio-snapshot.local.json';

interface Args {
  user?: string;
  out: string;
  env?: string;
}

function parseArgs(argv: string[]): Args {
  const out: Partial<Args> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--') continue; // bare separator (pnpm passes one through) — ignore
    const take = (inline: string) =>
      inline.includes('=') ? inline.slice(inline.indexOf('=') + 1) : argv[++i];
    if (a === '--user' || a.startsWith('--user=')) out.user = take(a);
    else if (a === '--out' || a.startsWith('--out=')) out.out = take(a);
    else if (a === '--env' || a.startsWith('--env=')) out.env = take(a);
    else die(`unknown argument: ${a}`);
  }
  return { user: out.user, out: out.out ?? DEFAULT_OUT, env: out.env };
}

function expandHome(p: string): string {
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : p;
}

function die(msg: string): never {
  console.error(`export:snapshot: ${msg}`);
  process.exit(1);
}

/** Minimal .env loader (KEY=VALUE, # comments). Never overrides already-set vars. */
function loadEnvFile(path: string): boolean {
  if (!existsSync(path)) return false;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = val;
  }
  return true;
}

/** Load env from --env, or the server/app .env files, before any repo import. */
function ensureEnv(explicitEnvPath?: string): void {
  const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const candidates = explicitEnvPath
    ? [expandHome(explicitEnvPath)]
    : [join(serverRoot, '.env'), join(serverRoot, '..', '.env')];
  for (const c of candidates) loadEnvFile(c);

  if (!process.env.PB_URL) {
    die(
      'PB_URL is not set. Provide it in the environment or a .env file ' +
        '(also needs PB_ADMIN_TOKEN, or PB_ADMIN_EMAIL + PB_ADMIN_PASSWORD).',
    );
  }
}

/** Resolve a --user value (PB id, firebase_uid, or email) to a pbUserId. */
async function resolveUserId(
  pb: import('pocketbase').default,
  userArg: string,
): Promise<{ pbUserId: string; email: string }> {
  if (userArg.includes('@')) {
    const res = await pb
      .collection('users')
      .getList(1, 2, { filter: pb.filter('email = {:e}', { e: userArg }) });
    if (res.totalItems === 0) die(`no user found with email "${userArg}"`);
    if (res.totalItems > 1) die(`ambiguous: ${res.totalItems} users with email "${userArg}"`);
    return { pbUserId: res.items[0].id, email: userArg };
  }
  // Try as a PocketBase record id.
  try {
    const u = await pb.collection('users').getOne(userArg);
    return { pbUserId: u.id, email: (u as { email?: string }).email ?? '' };
  } catch {
    /* not a record id — try firebase_uid below */
  }
  const res = await pb
    .collection('users')
    .getList(1, 2, { filter: pb.filter('firebase_uid = {:u}', { u: userArg }) });
  if (res.totalItems === 1) {
    return { pbUserId: res.items[0].id, email: (res.items[0] as { email?: string }).email ?? '' };
  }
  return die(`no user found for "${userArg}" (tried record id, firebase_uid, and email)`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.user) die('missing required --user <id|email>');
  ensureEnv(args.env);

  // Dynamic imports AFTER env is loaded (these modules read env at load time).
  const { pbAdmin } = await import('../lib/pb');
  const { holdingsRepo } = await import('../db/holdings');
  const { priceCacheRepo } = await import('../db/priceCache');
  const { symbolProfilesRepo } = await import('../db/symbolProfiles');
  const { fxRatesRepo } = await import('../db/fxRates');

  const pb = await pbAdmin();
  const { pbUserId, email } = await resolveUserId(pb, args.user as string);

  const [holdings, prices, profiles, fxRow] = await Promise.all([
    holdingsRepo.listForUser(pbUserId, { openOnly: true }),
    priceCacheRepo.list(),
    symbolProfilesRepo.list(),
    fxRatesRepo.getLatest(),
  ]);

  const snapshot = buildSnapshot({
    holdings,
    prices,
    profiles,
    // No { EUR: 1 } fallback: an empty map makes buildSnapshot's FX-coverage
    // guard throw for any non-EUR holding, rather than silently valuing it at 0.
    fxRates: fxRow?.rates ?? {},
  });

  const outPath = resolve(expandHome(args.out));
  mkdirSync(dirname(outPath), { recursive: true });
  const tmp = `${outPath}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  renameSync(tmp, outPath); // atomic on the same filesystem

  console.log(
    `export:snapshot: wrote ${snapshot.holdings.length} holdings ` +
      `(€${snapshot.totals.valueEur.toLocaleString()}) for ${email || pbUserId} → ${outPath}`,
  );
}

main().catch((err) => {
  die(err instanceof Error ? err.message : String(err));
});
