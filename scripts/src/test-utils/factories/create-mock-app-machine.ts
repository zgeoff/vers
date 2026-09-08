import { faker } from '@faker-js/faker';
import type { AppMachine } from '../../deploy/types';

export function createMockAppMachine(overrides: Readonly<Partial<AppMachine>> = {}): AppMachine {
  return {
    checks: [],
    gitSHA: faker.git.commitSha(),
    id: faker.string.hexadecimal({ casing: 'lower', length: 14, prefix: '' }),
    image: `registry.fly.io/${faker.lorem.slug(2)}:${faker.string.alphanumeric({ casing: 'lower', length: 12 })}`,
    state: 'started',
    ...overrides,
  };
}
