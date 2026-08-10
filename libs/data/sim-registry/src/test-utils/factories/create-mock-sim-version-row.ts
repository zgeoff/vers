import { faker } from '@faker-js/faker';
import type { SimVersionRow } from '../../types';

/**
 * A plain, unpersisted `sim_versions` row with faker-generated defaults. Never requires a parent.
 */
export function createMockSimVersionRow(
  overrides: Readonly<Partial<SimVersionRow>> = {},
): SimVersionRow {
  const createdAt = faker.date.recent();

  return {
    bunVersion: faker.system.semver(),
    createdAt,
    deployedAt: faker.date.between({ from: createdAt, to: new Date() }),
    engineHash: faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' }),
    imageRef: `registry.fly.io/vers-sim:${faker.string.alphanumeric({ casing: 'lower', length: 12 })}`,
    maxContentVersion: '999999999',
    providerUrl: faker.internet.url(),
    retainedUntil: faker.date.future(),
    status: 'active',
    ...overrides,
  };
}
