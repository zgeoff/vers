import { faker } from '@faker-js/faker';
import type { SessionData } from '@vers/contract-session';

export function createMockSessionData(overrides: Partial<SessionData> = {}): SessionData {
  return {
    createdAt: faker.date.recent(),
    expiresAt: faker.date.soon(),
    id: faker.string.alphanumeric({ casing: 'lower', length: 24 }),
    ipAddress: faker.internet.ipv4(),
    updatedAt: faker.date.recent(),
    userID: faker.string.alphanumeric({ casing: 'lower', length: 24 }),
    verified: true,
    ...overrides,
  };
}
