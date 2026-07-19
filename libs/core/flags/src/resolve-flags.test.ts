import { expect, test } from 'bun:test';
import { updateEnv } from '@vers/test-utils/bun';
import { resolveFlags } from './resolve-flags';

test('it resolves every registered flag to its default when no env vars are set', async () => {
  const flags = await resolveFlags();

  expect(flags).toStrictEqual({ 'game-renderer': true, market: false });
});

test('it resolves a flag to true when its env var is set to "true"', async () => {
  updateEnv('FEATURE_MARKET', 'true');

  const flags = await resolveFlags();

  expect(flags).toStrictEqual({ 'game-renderer': true, market: true });
});

test('it resolves a default-on flag to false when its env var is set to "false"', async () => {
  updateEnv('FEATURE_GAME_RENDERER', 'false');

  const flags = await resolveFlags();

  expect(flags).toStrictEqual({ 'game-renderer': false, market: false });
});
