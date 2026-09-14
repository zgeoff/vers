import { faker } from '@faker-js/faker';
import type { SigningKey } from '../../signing-key-set-schema';

export function createMockSigningKey(overrides: Partial<SigningKey> = {}): SigningKey {
  return {
    alg: 'RS256',
    e: 'AQAB',
    kid: faker.string.alphanumeric({ casing: 'mixed', length: 43 }),
    kty: 'RSA',
    n: faker.string.alphanumeric({ casing: 'mixed', length: 342 }),
    use: 'sig',
    ...overrides,
  };
}
