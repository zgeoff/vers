import { expect, test } from 'bun:test';
import { parseEnvKeys } from './parse-env-keys';

test('it collects assigned keys and skips comments, blanks, and values', () => {
  const keys = parseEnvKeys(
    [
      '# base service env',
      'NODE_ENV="development"',
      '',
      'DATABASE_URL=',
      String.raw`SERVICE_AUTH_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nabc\n-----END PUBLIC KEY-----\n"`,
      'export EXPORTED_KEY=1',
      'not a key line',
    ].join('\n'),
  );

  expect(keys).toStrictEqual([
    'NODE_ENV',
    'DATABASE_URL',
    'SERVICE_AUTH_PUBLIC_KEY',
    'EXPORTED_KEY',
  ]);
});

test('it returns no keys for an empty file', () => {
  expect(parseEnvKeys('')).toBeEmpty();
});
