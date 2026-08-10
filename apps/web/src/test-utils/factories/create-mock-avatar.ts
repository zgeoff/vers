import { faker } from '@faker-js/faker';
import type { AvatarData } from '@vers/contract-avatar';

export function createMockAvatar(overrides: Readonly<Partial<AvatarData>> = {}): AvatarData {
  return {
    createdAt: faker.date.past(),
    id: faker.string.uuid(),
    level: faker.number.int({ max: 99, min: 1 }),
    mode: 'trade',
    name: faker.person.firstName(),
    seed: faker.number.int({ max: 2 ** 31 - 1, min: 0 }),
    updatedAt: faker.date.recent(),
    userID: faker.string.uuid(),
    xp: faker.number.int({ max: 100_000, min: 0 }),
    ...overrides,
  };
}
