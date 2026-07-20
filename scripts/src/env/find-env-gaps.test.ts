import { expect, test } from 'bun:test';
import { findEnvGaps } from './find-env-gaps';

test('it reports each source missing a required key', () => {
  const gaps = findEnvGaps(
    ['DATABASE_URL', 'SERVICE_AUTH_JWKS'],
    [
      { available: new Set(['DATABASE_URL']), label: 'fly.toml' },
      { available: new Set(['DATABASE_URL', 'SERVICE_AUTH_JWKS']), label: 'stack.env' },
      { available: new Set(), label: '.env.development' },
    ],
  );

  expect(gaps).toStrictEqual([
    { label: 'fly.toml', missing: ['SERVICE_AUTH_JWKS'] },
    { label: '.env.development', missing: ['DATABASE_URL', 'SERVICE_AUTH_JWKS'] },
  ]);
});

test('it reports nothing when every source covers the requirement', () => {
  const gaps = findEnvGaps(
    ['DATABASE_URL'],
    [{ available: new Set(['DATABASE_URL', 'EXTRA']), label: 'fly.toml' }],
  );

  expect(gaps).toBeEmpty();
});
