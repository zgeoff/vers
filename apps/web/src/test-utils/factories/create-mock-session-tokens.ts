import { faker } from '@faker-js/faker';
import type { SessionTokens } from '@vers/contract-session';

export function createMockSessionTokens(overrides: Partial<SessionTokens> = {}): SessionTokens {
  return {
    accessToken: faker.string.alphanumeric(32),
    refreshToken: faker.string.alphanumeric(32),
    ...overrides,
  };
}
