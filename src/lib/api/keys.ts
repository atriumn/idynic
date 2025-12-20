import { createHash, randomBytes } from 'crypto';

const KEY_PREFIX = 'idn_';
const KEY_BYTES = 32;

/**
 * Generate a new API key.
 * Returns both the full key (to show user once) and the hash (to store).
 */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomPart = randomBytes(KEY_BYTES).toString('hex');
  const key = `${KEY_PREFIX}${randomPart}`;
  const hash = hashApiKey(key);
  const prefix = `${KEY_PREFIX}${randomPart.slice(0, 4)}`;

  return { key, hash, prefix };
}

/**
 * Hash an API key for storage/lookup.
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Validate API key format.
 */
export function isValidApiKeyFormat(key: string): boolean {
  // idn_ prefix + 64 hex chars
  return /^idn_[a-f0-9]{64}$/.test(key);
}
