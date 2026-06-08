import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from '../../src/lib/crypto';
describe('crypto', () => {
  const KEY = 'a'.repeat(64); // 32-byte hex
  it('round-trips', () => {
    const ct = encryptSecret('my-t212-key', KEY);
    expect(ct).not.toContain('my-t212-key');
    expect(decryptSecret(ct, KEY)).toBe('my-t212-key');
  });
  it('fails on tampered ciphertext', () => {
    const ct = encryptSecret('x', KEY);
    expect(() => decryptSecret(ct.slice(0, -2) + '00', KEY)).toThrow();
  });
});
