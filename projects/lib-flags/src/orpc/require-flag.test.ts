import { expect, test } from 'bun:test';
import { call, os } from '@orpc/server';
import { updateEnv } from '@vers/test-utils/bun';
import * as z from 'zod';
import { requireFlag } from './require-flag';

const procedure = os
  .input(z.object({}))
  .output(z.object({ ok: z.boolean() }))
  .use(requireFlag('market'))
  .handler(() => ({ ok: true }));

test('it rejects with NOT_FOUND when the flag is off', () => {
  expect(call(procedure, {})).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

test('it runs the handler when the flag is on', async () => {
  updateEnv('FEATURE_MARKET', 'true');

  const result = await call(procedure, {});

  expect(result).toStrictEqual({ ok: true });
});
