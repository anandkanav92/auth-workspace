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
  it('throws on a wrong-length hex key (31 bytes)', () => {
    const shortKey = 'a'.repeat(62); // 31 bytes — not 32
    expect(() => encryptSecret('x', shortKey)).toThrow();
  });
  it('throws on non-hex key input', () => {
    const nonHex = 'z'.repeat(64); // valid length string, but not hex
    expect(() => encryptSecret('x', nonHex)).toThrow();
  });
});
