import { expect, test } from 'bun:test';
import * as z from 'zod';
import { toFieldErrors } from './to-field-errors';

const Schema = z.object({
  email: z.email('Invalid email'),
  password: z.string().min(8, 'Too short'),
});

test('it maps each failing field to its first issue message', () => {
  const result = Schema.safeParse({ email: 'not-an-email', password: 'x' });

  if (result.success) {
    throw new Error('expected the parse to fail');
  }

  expect(toFieldErrors(result.error, ['email', 'password'])).toStrictEqual({
    email: 'Invalid email',
    password: 'Too short',
  });
});

test('it drops issues for fields outside the listed set', () => {
  const result = Schema.safeParse({ email: 'not-an-email', password: 'x' });

  if (result.success) {
    throw new Error('expected the parse to fail');
  }

  expect(toFieldErrors(result.error, ['password'])).toStrictEqual({ password: 'Too short' });
});

test('it keeps the first message when one field fails twice', () => {
  const DoubleSchema = z.object({
    password: z.string().min(8, 'Too short').regex(/\d/u, 'Needs a digit'),
  });

  const result = DoubleSchema.safeParse({ password: 'x' });

  if (result.success) {
    throw new Error('expected the parse to fail');
  }

  expect(toFieldErrors(result.error, ['password'])).toStrictEqual({ password: 'Too short' });
});
