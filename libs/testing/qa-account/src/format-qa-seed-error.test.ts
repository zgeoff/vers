import { expect, test } from 'bun:test';
import { ORPCError } from '@orpc/client';
import { formatQASeedError } from './format-qa-seed-error';

test('it points an existing account at qa:reset', () => {
  const error = new ORPCError('CONFLICT', {
    data: { field: 'email', value: 'qa-heron@qa.versidle.com' },
    defined: true,
  });

  expect(formatQASeedError(error, { host: 'localhost:3000', user: 'qa-heron' })).toBe(
    'qa-heron@qa.versidle.com already exists; run qa:reset --user qa-heron --all first',
  );
});

test.each([
  {
    expected: 'another account holds the username qa_007; pick another --user',
    field: 'username',
    value: 'qa_007',
  },
  {
    expected: 'another account holds the avatar name qaaah; pick another --user',
    field: 'avatarName',
    value: 'qaaah',
  },
] as const)('it asks for another account name when the $field clashes', (row) => {
  const error = new ORPCError('CONFLICT', {
    data: { field: row.field, value: row.value },
    defined: true,
  });

  expect(formatQASeedError(error, { host: 'localhost:3000', user: 'qa.007' })).toBe(row.expected);
});

test('it prints the reason the service gives for an invalid account name', () => {
  const error = new ORPCError('QA_ACCOUNT_NAME_INVALID', {
    data: { reason: 'the QA account name yields no valid avatar name ("q")' },
    defined: true,
    status: 400,
  });

  expect(formatQASeedError(error, { host: 'localhost:3000', user: 'q1' })).toBe(
    'the QA account name yields no valid avatar name ("q")',
  );
});

test.each([
  { expected: 'preview.example.dev refused QA_SEED_TOKEN', status: 401 },
  { expected: 'preview.example.dev has QA seeding switched off', status: 404 },
  {
    expected:
      'preview.example.dev answered 503; the account may still have been created, so rerun once: a CONFLICT on the email means it was',
    status: 503,
  },
  { expected: 'preview.example.dev answered 502: Service Unavailable', status: 502 },
])('it explains a $status from the edge', (row) => {
  const error = new ORPCError('UNKNOWN', { message: 'Service Unavailable', status: row.status });

  expect(formatQASeedError(error, { host: 'preview.example.dev', user: 'qa-heron' })).toBe(
    row.expected,
  );
});

test('it passes a transport failure through with its own message', () => {
  expect(
    formatQASeedError(new Error('connect ECONNREFUSED 127.0.0.1:3000'), {
      host: 'localhost:3000',
      user: 'qa-heron',
    }),
  ).toBe('connect ECONNREFUSED 127.0.0.1:3000');
});
