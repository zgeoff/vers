import { expect, test } from 'bun:test';
import * as z from 'zod';
import { defineErrors } from './define-errors';

test('it returns the error map unchanged', () => {
  const errors = defineErrors({
    NOT_FOUND: { data: z.object({}), message: 'Not found' },
    RESET_TOKEN_EXPIRED: { data: z.object({}), message: 'Expired', status: 410 },
  });

  expect(errors.NOT_FOUND.message).toBe('Not found');
  expect(errors.RESET_TOKEN_EXPIRED.status).toBe(410);
});

test('it rejects a bespoke code without a status at compile time', () => {
  const errors = defineErrors({
    // @ts-expect-error -- bespoke codes must declare an explicit status
    RESET_TOKEN_EXPIRED: { data: z.object({}), message: 'Expired' },
  });

  expect(errors).toContainAllKeys(['RESET_TOKEN_EXPIRED']);
});

test('it rejects a canonical code that restates its built-in status at compile time', () => {
  const errors = defineErrors({
    // @ts-expect-error -- canonical codes keep oRPC's built-in status
    NOT_FOUND: { data: z.object({}), message: 'Not found', status: 404 },
  });

  expect(errors).toContainAllKeys(['NOT_FOUND']);
});
