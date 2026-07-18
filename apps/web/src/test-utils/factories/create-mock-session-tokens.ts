import { faker } from '@faker-js/faker';

/**
 * The token pair a session refresh returns over the wire.
 */
interface SessionTokensData {
  accessToken: string;
  refreshToken: string;
}

export function createMockSessionTokens(
  overrides: Partial<SessionTokensData> = {},
): SessionTokensData {
  return {
    accessToken: faker.string.alphanumeric(32),
    refreshToken: faker.string.alphanumeric(32),
    ...overrides,
  };
}
