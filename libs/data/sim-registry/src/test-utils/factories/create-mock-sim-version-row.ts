import { faker } from '@faker-js/faker';
import { BUNDLED_CONTENT_VERSION } from '@vers/content-version';
import type { SimVersionRow } from '../../types';

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
    maxContentVersion: BUNDLED_CONTENT_VERSION,
    providerUrl: faker.internet.url(),
    retainedUntil: faker.date.future(),
    status: 'active',
    ...overrides,
  };
}
