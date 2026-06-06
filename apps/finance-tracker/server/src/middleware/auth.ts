import { createMiddleware } from 'hono/factory';
import { firebaseAuth } from '../lib/firebase';
import { pbAdmin } from '../lib/pb';
import { uidToPbId } from '../lib/uidCache';

// Every /api/* request must carry a valid Firebase ID token. On first hit for a
// given UID we upsert a PocketBase `users` row keyed on firebase_uid (matches
// M1 schema), then cache UID -> pbUserId so subsequent requests skip PocketBase.
export const authMiddleware = createMiddleware<{
  Variables: { uid: string; email: string; pbUserId: string };
}>(async (c, next) => {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) return c.json({ error: 'unauthorized' }, 401);

  let decoded;
  try {
    decoded = await firebaseAuth.verifyIdToken(auth.slice(7));
  } catch {
    return c.json({ error: 'invalid token' }, 401);
  }

  c.set('uid', decoded.uid);
  c.set('email', decoded.email ?? '');

  let pbUserId = uidToPbId.get(decoded.uid);
  if (!pbUserId) {
    const pb = await pbAdmin();
    const existing = await pb
      .collection('users')
      .getFirstListItem(`firebase_uid="${decoded.uid}"`)
      .catch(() => null);
    if (existing) {
      pbUserId = existing.id;
    } else {
      const password = crypto.randomUUID();
      const created = await pb.collection('users').create({
        firebase_uid: decoded.uid,
        email: decoded.email,
        emailVisibility: false,
        password,
        passwordConfirm: password, // reviewer fix B1a: must equal password
      });
      pbUserId = created.id;
    }
    uidToPbId.set(decoded.uid, pbUserId); // reviewer fix B1b
  }
  c.set('pbUserId', pbUserId);
  await next();
});
