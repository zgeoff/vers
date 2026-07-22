import { faker } from '@faker-js/faker';
import type { UserData } from '@vers/contract-user';

export function createMockUser(overrides: Readonly<Partial<UserData>> = {}): UserData {
  return {
    createdAt: faker.date.past(),
    email: faker.internet.email(),
    id: faker.string.uuid(),
    name: faker.person.firstName(),
    seed: faker.number.int({ max: 100_000, min: 0 }),
    updatedAt: faker.date.recent(),
    username: faker.internet.username(),
    ...overrides,
  };
}
