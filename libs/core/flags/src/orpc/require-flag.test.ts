import { expect, test } from 'bun:test';
import { call, os } from '@orpc/server';
import { updateEnv } from '@vers/test-utils/bun';
import * as z from 'zod';
import { requireFlag } from './require-flag';

function setupTest() {
  const procedure = os
    .input(z.object({}))
    .output(z.object({ ok: z.boolean() }))
    .use(requireFlag('market'))
    .handler(() => ({ ok: true }));

  return { procedure };
}

test('it rejects with NOT_FOUND when the flag is off', () => {
  const ctx = setupTest();

  expect(call(ctx.procedure, {})).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it runs the handler when the flag is on', async () => {
  const ctx = setupTest();

  updateEnv('FEATURE_MARKET', 'true');

  const result = await call(ctx.procedure, {});

  expect(result).toStrictEqual({ ok: true });
});
