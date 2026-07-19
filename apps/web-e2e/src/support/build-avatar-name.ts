import { randomBytes } from 'node:crypto';

/**
 * A globally-unique avatar name: `AvatarNameSchema` accepts letters only, and the real stack's
 * database persists across runs and enforces the same uniqueness the mock backend does.
 */
export function buildAvatarName(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';

  return Array.from(randomBytes(12), (byte) => alphabet[byte % alphabet.length]).join('');
}
