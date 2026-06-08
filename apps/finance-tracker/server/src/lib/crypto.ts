// AES-256-GCM helper for encrypting the read-only broker API key at rest
// (plan Task 1.3, design §5). The key is a 32-byte secret supplied as a 64-char
// hex string (`T212_KEY_ENC_SECRET`, generated via `openssl rand -hex 32`).
//
// Serialisation format: `base64(iv).base64(tag).base64(ciphertext)`.
//   - iv:  random 12 bytes (GCM's recommended nonce length)
//   - tag: the 16-byte GCM authentication tag (detects tampering on decrypt)
// Decrypt verifies the tag, so any mutation of iv/tag/ciphertext throws.

import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // bytes — GCM standard nonce length
const KEY_LENGTH = 32; // bytes — AES-256

/** Parse the hex key into a 32-byte Buffer, failing loudly on a bad length. */
function keyFromHex(hexKey: string): Buffer {
  const key = Buffer.from(hexKey, 'hex');
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `encryption key must be ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars), got ${key.length}`,
    );
  }
  return key;
}

/** Encrypt `plaintext`, returning `base64(iv).base64(tag).base64(ct)`. */
export function encryptSecret(plaintext: string, hexKey: string): string {
  const key = keyFromHex(hexKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${ciphertext.toString('base64')}`;
}

/** Decrypt a value produced by {@link encryptSecret}. Throws if tampered. */
export function decryptSecret(serialized: string, hexKey: string): string {
  const key = keyFromHex(hexKey);
  const parts = serialized.split('.');
  if (parts.length !== 3) {
    throw new Error('invalid ciphertext: expected iv.tag.ciphertext');
  }
  const [ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(), // throws if the auth tag does not verify
  ]);
  return plaintext.toString('utf8');
}
