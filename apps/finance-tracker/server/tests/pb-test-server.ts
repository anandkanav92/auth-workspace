// Integration-test harness: boots the local PocketBase binary as a child
// process with our committed migrations applied, seeds a superuser + two test
// users, and tears it all down afterwards.
//
// Used as a Vitest `globalSetup` for the *.integration.test.ts suite. This is a
// genuine integration test (it talks to a real PocketBase), NOT a unit test —
// hence the explicit naming. See pb-schema/README.md.

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = resolve(fileURLToPath(import.meta.url), '..');
const SERVER_ROOT = resolve(HERE, '..');
const PB_BINARY = join(SERVER_ROOT, '.pb', 'pocketbase');
const MIGRATIONS_DIR = join(SERVER_ROOT, 'pb-schema', 'migrations');

// Bind to a non-default, loopback-only port to avoid clobbering any other PB.
// 127.0.0.1 (not localhost) sidesteps the SDK's ECONNREFUSED ::1 footgun.
const PB_HOST = '127.0.0.1';
const PB_PORT = 8097;
export const PB_URL = `http://${PB_HOST}:${PB_PORT}`;

export const SUPERUSER = { email: 'super@test.com', password: 'password123' };
export const USER_A = { email: 'a@test.com', password: 'password123' };
export const USER_B = { email: 'b@test.com', password: 'password123' };

let pbProcess: ChildProcess | undefined;
let dataDir: string | undefined;

function run(args: string[]) {
  const res = spawnSync(PB_BINARY, args, { encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(
      `pocketbase ${args.join(' ')} failed (status ${res.status}):\n${res.stderr || res.stdout}`,
    );
  }
  return res.stdout;
}

async function waitForHealth(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${PB_URL}/api/health`);
      if (r.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`PocketBase did not become healthy at ${PB_URL} within ${timeoutMs}ms`);
}

/** Create a regular `users` auth-collection record via the superuser REST API. */
async function createUser(superToken: string, email: string, password: string) {
  const r = await fetch(`${PB_URL}/api/collections/users/records`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${superToken}`,
    },
    body: JSON.stringify({
      email,
      password,
      passwordConfirm: password,
      emailVisibility: true,
      verified: true,
      firebase_uid: `fb-${email}`,
    }),
  });
  if (!r.ok) {
    throw new Error(`createUser(${email}) failed: ${r.status} ${await r.text()}`);
  }
}

export async function setup() {
  if (!existsSync(PB_BINARY)) {
    throw new Error(
      `PocketBase binary not found at ${PB_BINARY}.\n` +
        `Download v0.23.11 (darwin_arm64) into apps/finance-tracker/server/.pb/ — see pb-schema/README.md.`,
    );
  }

  dataDir = mkdtempSync(join(tmpdir(), 'ft-pb-'));

  // 1. Apply our committed migrations to a throwaway data dir.
  run(['migrate', 'up', `--migrationsDir=${MIGRATIONS_DIR}`, `--dir=${dataDir}`]);

  // 2. Seed a superuser (so we can create the two test users via REST).
  run(['superuser', 'upsert', SUPERUSER.email, SUPERUSER.password, `--dir=${dataDir}`]);

  // 3. Boot the server.
  pbProcess = spawn(
    PB_BINARY,
    ['serve', `--http=${PB_HOST}:${PB_PORT}`, `--dir=${dataDir}`, `--migrationsDir=${MIGRATIONS_DIR}`],
    { stdio: 'ignore' },
  );
  pbProcess.on('error', (err) => {
    throw new Error(`Failed to spawn PocketBase: ${err.message}`);
  });

  await waitForHealth();

  // 4. Authenticate as superuser and create the two isolated test users.
  const authRes = await fetch(
    `${PB_URL}/api/collections/_superusers/auth-with-password`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: SUPERUSER.email, password: SUPERUSER.password }),
    },
  );
  if (!authRes.ok) {
    throw new Error(`superuser auth failed: ${authRes.status} ${await authRes.text()}`);
  }
  const { token } = (await authRes.json()) as { token: string };

  await createUser(token, USER_A.email, USER_A.password);
  await createUser(token, USER_B.email, USER_B.password);

  // Hand the URL to the test process.
  process.env.PB_URL = PB_URL;
}

export async function teardown() {
  if (pbProcess && !pbProcess.killed) {
    pbProcess.kill('SIGTERM');
    // Give it a moment, then force.
    await new Promise((r) => setTimeout(r, 300));
    if (!pbProcess.killed) pbProcess.kill('SIGKILL');
  }
  if (dataDir) {
    rmSync(dataDir, { recursive: true, force: true });
  }
}
