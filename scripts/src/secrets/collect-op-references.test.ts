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

test('it collects a reference inside a command substitution', () => {
  expect(
    collectOPReferences(`TOKEN="$(op read 'op://ops/tracker/mcp-token')" exec ./tracker-mcp`),
  ).toStrictEqual({
    references: [{ field: 'mcp-token', item: 'tracker', vault: 'ops' }],
    unparsed: [],
  });
});

test.each([
  ['single quotes', String.raw`op read 'op://ops/billing/token(prod)'`],
  ['double quotes', String.raw`op read "op://ops/billing/token(prod)"`],
  ['ANSI-C quotes', String.raw`op read $'op://ops/billing/token(prod)'`],
  [
    'escaped quotes in a nested shell',
    String.raw`sh -c "op read \"op://ops/billing/token(prod)\""`,
  ],
])('it collects the whole field inside %s', (_form, text) => {
  expect(collectOPReferences(text)).toStrictEqual({
    references: [{ field: 'token(prod)', item: 'billing', vault: 'ops' }],
    unparsed: [],
  });
});

test.each([
  ['a bare suffix on single quotes', String.raw`op read 'op://ops/billing/token'-v2`],
  ['a bare suffix on double quotes', String.raw`op read "op://ops/billing/token"-v2`],
  ['a bare suffix on ANSI-C quotes', String.raw`op read $'op://ops/billing/token'-v2`],
  ['a double-quoted suffix on single quotes', String.raw`op read 'op://ops/billing/token'"-v2"`],
  ['a single-quoted suffix on double quotes', String.raw`op read "op://ops/billing/token"'-v2'`],
  ['an escaped suffix on a bare reference', String.raw`op read op://ops/billing/token\-v2`],
])('it reads %s as one field', (_form, text) => {
  expect(collectOPReferences(text)).toStrictEqual({
    references: [{ field: 'token-v2', item: 'billing', vault: 'ops' }],
    unparsed: [],
  });
});

test.each([
  ['2>/dev/null', 'op read op://ops/billing/token 2>/dev/null'],
  ['2>&1', 'op read op://ops/billing/token 2>&1'],
  ['>&2', 'op read op://ops/billing/token >&2'],
  ['a redirection glued to the reference', 'op read op://ops/billing/token>/dev/null'],
])('it keeps the %s redirection out of the reference', (_redirection, text) => {
  expect(collectOPReferences(text)).toStrictEqual({
    references: [{ field: 'token', item: 'billing', vault: 'ops' }],
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

test.each([
  [
    'an apostrophe in double quotes',
    `op read "op://ops/Billing's Portal/token"`,
    "Billing's Portal",
  ],
  [
    'a double quote in single quotes',
    `op read 'op://ops/the "prod" item/token'`,
    'the "prod" item',
  ],
  [
    'an escaped apostrophe in ANSI-C quotes',
    String.raw`op read $'op://ops/Billing\'s Portal/token'`,
    "Billing's Portal",
  ],
  [
    'an escaped double quote in double quotes',
    String.raw`op read "op://ops/the \"prod\" item/token"`,
    'the "prod" item',
  ],
  [
    'an escaped apostrophe in a bare word',
    String.raw`op read op://ops/Billing\'s/token`,
    "Billing's",
  ],
  [
    'an apostrophe in a nested shell',
    String.raw`sh -c "op read \"op://ops/Billing's Portal/token\""`,
    "Billing's Portal",
  ],
])('it keeps %s inside the item name', (_form, text, item) => {
  expect(collectOPReferences(text)).toStrictEqual({
    references: [{ field: 'token', item, vault: 'ops' }],
    unparsed: [],
  });
});

test('it collects a quoted item name that holds spaces', () => {
  expect(collectOPReferences('API_KEY="op://ops/Billing Portal/api-key"\n')).toStrictEqual({
    references: [{ field: 'api-key', item: 'Billing Portal', vault: 'ops' }],
    unparsed: [],
  });
});

test('it reports an unquoted item name that holds spaces as unparsed', () => {
  expect(collectOPReferences('API_KEY=op://ops/Billing Portal/api-key\n')).toStrictEqual({
    references: [],
    unparsed: ['op://ops/Billing'],
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

test('it ends a reference before a trailing comment', () => {
  expect(collectOPReferences('API_KEY=op://ops/billing/api-key # rotated monthly\n')).toStrictEqual(
    { references: [{ field: 'api-key', item: 'billing', vault: 'ops' }], unparsed: [] },
  );
});

test.each([
  ['a variable', `op read "op://ops/$ITEM/dsn"`, 'op://ops/$ITEM/dsn'],
  [
    'an ANSI-C escape sequence',
    String.raw`op read $'op://ops/billing/token\n'`,
    'op://ops/billing/token$',
  ],
  ['an unclosed quote', `op read 'op://ops/billing/token`, 'op://ops/billing/token'],
])('it reports a reference that holds %s as unparsed', (_form, text, scanned) => {
  expect(collectOPReferences(text)).toStrictEqual({ references: [], unparsed: [scanned] });
});

test('it reports a reference with no field as unparsed', () => {
  expect(collectOPReferences('API_KEY=op://ops/billing\n')).toStrictEqual({
    references: [],
    unparsed: ['op://ops/billing'],
  });
});

test('it skips the scheme named in prose', () => {
  expect(
    collectOPReferences('- every value is an op:// reference, and `op://` names the scheme\n'),
  ).toStrictEqual({ references: [], unparsed: [] });
});
