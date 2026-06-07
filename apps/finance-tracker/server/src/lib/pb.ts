import PocketBase from 'pocketbase';

// Reviewer fix B2: never share a single PocketBase instance (and its authStore)
// across requests — concurrent writes race on the shared authStore. Instead we
// hand out a FRESH client per call, each backed by a long-lived admin
// impersonation token (PB_ADMIN_TOKEN) loaded at boot. If the token is absent,
// fall back to admin email/password and log a startup warning.
const ADMIN_TOKEN = process.env.PB_ADMIN_TOKEN;
const ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD;
const PB_URL = process.env.PB_URL!;

if (!ADMIN_TOKEN && !(ADMIN_EMAIL && ADMIN_PASSWORD)) {
  throw new Error('Set PB_ADMIN_TOKEN, or PB_ADMIN_EMAIL+PB_ADMIN_PASSWORD');
}
if (!ADMIN_TOKEN) {
  console.warn(
    'PB_ADMIN_TOKEN not set — falling back to admin email/password. Issue a long-lived token in prod.',
  );
}

/** Returns a fresh PB client per call. Never share authStore across requests. */
export async function pbAdmin(): Promise<PocketBase> {
  const pb = new PocketBase(PB_URL);
  if (ADMIN_TOKEN) {
    pb.authStore.save(ADMIN_TOKEN, null);
    return pb;
  }
  await pb.admins.authWithPassword(ADMIN_EMAIL!, ADMIN_PASSWORD!);
  return pb;
}
