import { faker } from '@faker-js/faker';
import { createId } from '@paralleldrive/cuid2';
import type { AvatarData } from '../../avatar-data-schema';

export function createMockAvatarData(overrides: Partial<AvatarData> = {}): AvatarData {
  const createdAt = faker.date.recent();

  return {
    createdAt,
    id: createId(),
    level: faker.number.int({ max: 99, min: 1 }),
    name: faker.person.firstName(),
    updatedAt: createdAt,
    userID: createId(),
    xp: faker.number.int({ max: 10_000, min: 0 }),
    ...overrides,
  };
}
