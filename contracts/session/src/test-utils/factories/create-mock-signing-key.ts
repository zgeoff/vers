import { faker } from '@faker-js/faker';
import type { SigningKey } from '../../signing-key-set-schema';

export function createMockSigningKey(overrides: Partial<SigningKey> = {}): SigningKey {
  return {
    alg: 'RS256',
    // oxlint-disable-next-line id-length -- RFC 7518 names the RSA key's exponent and modulus `e` and `n`
    e: 'AQAB',
    kid: faker.string.alphanumeric({ casing: 'mixed', length: 43 }),
    kty: 'RSA',
    // oxlint-disable-next-line id-length -- RFC 7518 names the RSA key's exponent and modulus `e` and `n`
    n: faker.string.alphanumeric({ casing: 'mixed', length: 342 }),
    use: 'sig',
    ...overrides,
  };
}
