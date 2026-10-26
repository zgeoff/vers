import { expect, test } from 'bun:test';
import { collectOPReferences } from './collect-op-references';

test('it collects each reference in an env file', () => {
  expect(
    collectOPReferences('API_KEY=op://ops/billing/api-key\nREGION=op://ops/billing/region\n'),
  ).toStrictEqual({
    references: [
      { field: 'api-key', item: 'billing', vault: 'ops' },
      { field: 'region', item: 'billing', vault: 'ops' },
    ],
    unparsed: [],
  });
});

test('it collects a quoted reference inside a shell command', () => {
  expect(
    collectOPReferences(`TOKEN="$(op read 'op://ops/tracker/mcp-token')" exec ./tracker-mcp`),
  ).toStrictEqual({
    references: [{ field: 'mcp-token', item: 'tracker', vault: 'ops' }],
    unparsed: [],
  });
});

test('it collects a double-quoted reference inside a shell command', () => {
  expect(collectOPReferences('op read "op://ops/billing/api-key"')).toStrictEqual({
    references: [{ field: 'api-key', item: 'billing', vault: 'ops' }],
    unparsed: [],
  });
});

test('it collects an item name that holds spaces', () => {
  expect(collectOPReferences('API_KEY=op://ops/Billing Portal/api-key\n')).toStrictEqual({
    references: [{ field: 'api-key', item: 'Billing Portal', vault: 'ops' }],
    unparsed: [],
  });
});

test('it collects a field under a section as the section and field', () => {
  expect(collectOPReferences(`op read 'op://ops/billing/credentials/api-key'`)).toStrictEqual({
    references: [{ field: 'credentials/api-key', item: 'billing', vault: 'ops' }],
    unparsed: [],
  });
});

test('it collects a reference with a query as its field alone', () => {
  expect(collectOPReferences('CODE=op://ops/billing/one-time?attribute=otp\n')).toStrictEqual({
    references: [{ field: 'one-time', item: 'billing', vault: 'ops' }],
    unparsed: [],
  });
});

test.each([
  ['a semicolon', 'op read op://ops/login/code?attribute=otp; op read op://ops/service/token'],
  ['an and-list', 'op read op://ops/login/code?attribute=otp && op read op://ops/service/token'],
  ['a pipe', 'op read op://ops/login/code?attribute=otp | op read op://ops/service/token'],
  ['a space', 'op inject op://ops/login/code?attribute=otp op://ops/service/token'],
])('it collects each of two references separated by %s', (_separator, text) => {
  expect(collectOPReferences(text)).toStrictEqual({
    references: [
      { field: 'code', item: 'login', vault: 'ops' },
      { field: 'token', item: 'service', vault: 'ops' },
    ],
    unparsed: [],
  });
});

test('it ends a reference before a trailing comment', () => {
  expect(collectOPReferences('API_KEY=op://ops/billing/api-key # rotated monthly\n')).toStrictEqual(
    { references: [{ field: 'api-key', item: 'billing', vault: 'ops' }], unparsed: [] },
  );
});

test('it reports a reference that interpolates a segment as unparsed', () => {
  expect(collectOPReferences(`op read "op://ops/$ITEM/dsn"`)).toStrictEqual({
    references: [],
    unparsed: ['op://ops/$ITEM/dsn'],
  });
});

test('it reports a reference with no field as unparsed', () => {
  expect(collectOPReferences('API_KEY=op://ops/billing\n')).toStrictEqual({
    references: [],
    unparsed: ['op://ops/billing'],
  });
});

test('it skips the scheme named in prose', () => {
  expect(
    collectOPReferences('# every value is an op:// reference, and `op://` names the scheme\n'),
  ).toStrictEqual({ references: [], unparsed: [] });
});
