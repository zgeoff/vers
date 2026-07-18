import { expect, test } from 'bun:test';
import { createMockSessionTokens } from './create-mock-session-tokens';

test('it builds a token pair with non-empty tokens by default', () => {
  const tokens = createMockSessionTokens();

  expect(tokens).toContainAllKeys(['accessToken', 'refreshToken']);
  expect(tokens.accessToken).toMatch(/^[a-zA-Z0-9]{32}$/);
  expect(tokens.refreshToken).toMatch(/^[a-zA-Z0-9]{32}$/);
});

test('it applies overrides over the defaults', () => {
  const tokens = createMockSessionTokens({ refreshToken: 'refresh-token' });

  expect(tokens.refreshToken).toBe('refresh-token');
  expect(tokens.accessToken).toMatch(/^[a-zA-Z0-9]{32}$/);
});
