import { faker } from '@faker-js/faker';
import type { SimVersions } from '@vers/db';
import type { Insertable } from 'kysely';

/**
 * A plain, unpersisted `sim_versions` row with faker-generated defaults. Never requires a parent.
 */
export function createMockSimVersionRow(
  overrides: Readonly<Partial<Insertable<SimVersions>>> = {},
): Insertable<SimVersions> {
  return {
    bunVersion: faker.system.semver(),
    engineHash: faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' }),
    imageRef: `registry.fly.io/vers-sim:${faker.string.alphanumeric({ casing: 'lower', length: 12 })}`,
    providerUrl: faker.internet.url(),
    retainedUntil: faker.date.future(),
    status: 'active',
    ...overrides,
  };
}
