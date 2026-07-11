import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { Verifications } from '@vers/db';
import type { Insertable } from 'kysely';

/**
 * A plain, unpersisted verification row with faker-generated defaults for a TOTP onboarding code.
 */
export function createMockVerification(
  overrides: Partial<Insertable<Verifications>> = {},
): Insertable<Verifications> {
  return {
    algorithm: 'SHA-256',
    charSet: 'ABCDEFGHJKLMNPQRSTUVWXYZ123456789',
    digits: 6,
    expiresAt: null,
    id: createId(),
    period: 30,
    secret: faker.string.alphanumeric(32),
    target: faker.internet.email(),
    type: 'onboarding',
    ...overrides,
  };
}
