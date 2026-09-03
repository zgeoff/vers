import { faker } from '@faker-js/faker';
import type { ReleaseRow } from '../../types';

export function createMockReleaseRow(overrides: Readonly<Partial<ReleaseRow>> = {}): ReleaseRow {
  const sha = faker.git.commitSha();

  return {
    app: `vers-${faker.word.noun()}`,
    deployedAt: faker.date.recent(),
    gitSha: sha,
    id: faker.string.numeric({ allowLeadingZeros: false, length: 6 }),
    image: `registry.fly.io/vers-${faker.word.noun()}:deployment-${sha}`,
    imageDigest: `sha256:${faker.string.hexadecimal({ casing: 'lower', length: 64, prefix: '' })}`,
    ...overrides,
  };
}
