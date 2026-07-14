import { faker } from '@faker-js/faker';
import type { SimVersionRow } from '../../types';

/**
 * A plain, unpersisted `sim_versions` row with faker-generated defaults. Never requires a parent.
 */
export function createMockSimVersionRow(
  overrides: Readonly<Partial<SimVersionRow>> = {},
): SimVersionRow {
  return {
    bunVersion: faker.system.semver(),
    createdAt: faker.date.recent(),
    deployedAt: faker.date.recent(),
    engineHash: faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' }),
    imageRef: `registry.fly.io/vers-sim:${faker.string.alphanumeric({ casing: 'lower', length: 12 })}`,
    providerUrl: faker.internet.url(),
    retainedUntil: faker.date.future(),
    status: 'active',
    ...overrides,
  };
}
