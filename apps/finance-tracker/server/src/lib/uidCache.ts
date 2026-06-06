import { LRUCache } from 'lru-cache';

// Reviewer fix B1b: cache the Firebase UID -> PocketBase user id mapping so an
// authed request does not hit PocketBase on every call. Keyed on firebase_uid
// (design §13 decision: PB id stays auto-generated). 1h TTL, 1000 entries.
export const uidToPbId = new LRUCache<string, string>({
  max: 1000,
  ttl: 1000 * 60 * 60,
});
