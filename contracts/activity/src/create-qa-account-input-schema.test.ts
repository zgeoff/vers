import { expect, test } from 'bun:test';
import { CreateQAAccountInputSchema } from './create-qa-account-input-schema';

test('it accepts a level-1 account with no runs and no password', () => {
  const result = CreateQAAccountInputSchema.safeParse({
    level: 1,
    runs: 0,
    twoFactor: false,
    user: 'qa-river',
  });

  expect(result.data).toStrictEqual({ level: 1, runs: 0, twoFactor: false, user: 'qa-river' });
});

test('it accepts a level above 1 with at least one run', () => {
  const result = CreateQAAccountInputSchema.safeParse({
    level: 12,
    password: 'tall-grass-77',
    runs: 1,
    twoFactor: true,
    user: 'qa-river',
  });

  expect(result.success).toBeTrue();
});

test('it rejects a level above 1 with no runs on the runs field', () => {
  const result = CreateQAAccountInputSchema.safeParse({
    level: 6,
    runs: 0,
    twoFactor: false,
    user: 'qa-river',
  });

  expect(result.error?.issues).toPartiallyContain({ path: ['runs'] });
});

test.each([
  { field: 'level', input: { level: 0, runs: 1 } },
  { field: 'level', input: { level: 1001, runs: 1 } },
  { field: 'runs', input: { level: 2, runs: 21 } },
  { field: 'runs', input: { level: 1, runs: -1 } },
])('it rejects $field out of bounds in $input', (row) => {
  const result = CreateQAAccountInputSchema.safeParse({
    ...row.input,
    twoFactor: false,
    user: 'qa-river',
  });

  expect(result.error?.issues).toPartiallyContain({ path: [row.field] });
});

test('it accepts the bounds of level 1000 and 20 runs', () => {
  const result = CreateQAAccountInputSchema.safeParse({
    level: 1000,
    runs: 20,
    twoFactor: false,
    user: 'qa-river',
  });

  expect(result.success).toBeTrue();
});
