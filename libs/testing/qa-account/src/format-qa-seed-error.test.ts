import { expect, test } from 'bun:test';
import { ORPCError } from '@orpc/client';
import { formatQASeedError } from './format-qa-seed-error';

test('it points an existing account at qa:reset', () => {
  const error = new ORPCError('CONFLICT', { data: { field: 'email' }, defined: true });

  const user = {
    avatarName: 'qaheron',
    email: 'qa-heron@qa.versidle.com',
    name: 'qa-heron',
    username: 'qa_heron',
  };

  expect(formatQASeedError(error, { host: 'localhost:3000', user })).toBe(
    'qa-heron@qa.versidle.com already exists; run qa:reset --user qa-heron --all first',
  );
});

test.each([
  {
    expected: 'another account holds the username qa_007; pick another --user',
    field: 'username',
  },
  {
    expected: 'another account holds the avatar name qaaah; pick another --user',
    field: 'avatarName',
  },
] as const)('it asks for another account name when the $field clashes', (row) => {
  const error = new ORPCError('CONFLICT', { data: { field: row.field }, defined: true });

  const user = {
    avatarName: 'qaaah',
    email: 'qa.007@qa.versidle.com',
    name: 'qa.007',
    username: 'qa_007',
  };

  expect(formatQASeedError(error, { host: 'localhost:3000', user })).toBe(row.expected);
});

test('it explains an invalid account name from the reason the service gives', () => {
  const error = new ORPCError('QA_ACCOUNT_NAME_INVALID', {
    data: { reason: 'invalid-avatar-name' },
    defined: true,
    status: 422,
  });

  const user = { avatarName: 'qb', email: 'q1@qa.versidle.com', name: 'q1', username: 'q1' };

  expect(formatQASeedError(error, { host: 'localhost:3000', user })).toBe(
    'the QA account name "q1" yields no valid avatar name; pick another --user',
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

  const user = {
    avatarName: 'qaheron',
    email: 'qa-heron@qa.versidle.com',
    name: 'qa-heron',
    username: 'qa_heron',
  };

  expect(formatQASeedError(error, { host: 'preview.example.dev', user })).toBe(row.expected);
});

test('it passes a transport failure through with its own message', () => {
  const user = {
    avatarName: 'qaheron',
    email: 'qa-heron@qa.versidle.com',
    name: 'qa-heron',
    username: 'qa_heron',
  };

  expect(
    formatQASeedError(new Error('connect ECONNREFUSED 127.0.0.1:3000'), {
      host: 'localhost:3000',
      user,
    }),
  ).toBe('connect ECONNREFUSED 127.0.0.1:3000');
});
