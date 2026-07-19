import { expect, test } from 'bun:test';
import { createMockSessionTokens } from './create-mock-session-tokens';

test('it builds a token pair by default', () => {
  const tokens = createMockSessionTokens();

  expect(tokens).toStrictEqual({
    accessToken: expect.toBeString(),
    refreshToken: expect.toBeString(),
  });
});

test('it applies overrides on top of the defaults', () => {
  const tokens = createMockSessionTokens({ refreshToken: 'refresh-token' });

  expect(tokens).toStrictEqual({
    accessToken: expect.toBeString(),
    refreshToken: 'refresh-token',
  });
});
