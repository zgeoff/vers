import { expect, test } from 'bun:test';
import { collectOPReferences } from './collect-op-references';

test.each([
  ['an env file assignment', 'API_TOKEN=op://ops/billing/token\n'],
  ['a single-quoted shell argument', `TOKEN="$(op read 'op://ops/billing/token')" exec ./run`],
  ['a double-quoted shell argument', 'op read "op://ops/billing/token"'],
  ['a reference with a query', 'CODE=op://ops/billing/token?attribute=otp\n'],
  ['a markdown code span', 'read `op://ops/billing/token` at boot'],
  ['the end of the text', 'op read op://ops/billing/token'],
  ['a single quote at the end of the text', `op read 'op://ops/billing/token'`],
  [
    'a substitution inside a quoted URL',
    `"https://api.example?key=$(op read 'op://ops/billing/token')&region=eu"`,
  ],
  ['a substitution that closes a command', 'echo $(op read op://ops/billing/token)'],
  ['a backtick substitution', 'TOKEN=`op read op://ops/billing/token` exec ./run'],
])('it collects a literal reference in %s', (_form, text) => {
  expect(collectOPReferences(text)).toStrictEqual({
    references: [{ field: 'token', item: 'billing', vault: 'ops' }],
    unparsed: [],
  });
});

test('it collects each reference on a line in order', () => {
  expect(
    collectOPReferences(
      `USER="$(op read 'op://ops/panel/username')" PASS="$(op read 'op://ops/panel/password')"`,
    ),
  ).toStrictEqual({
    references: [
      { field: 'username', item: 'panel', vault: 'ops' },
      { field: 'password', item: 'panel', vault: 'ops' },
    ],
    unparsed: [],
  });
});

test.each([
  ['a space in a name', 'API_TOKEN=op://ops/Billing Portal/token\n', 'op://ops/Billing'],
  ['a quote in a name', `op read "op://ops/Billing's/token"`, `op://ops/Billing's/token"`],
  ['a variable', 'op read "op://ops/$ITEM/token"', 'op://ops/$ITEM/token"'],
  ['a GitHub expression', `op read "op://\${{ vars.VAULT }}/billing/token"`, 'op://${{'],
  ['a brace', 'op read op://ops/{item}/token', 'op://ops/{item}/token'],
  [
    'a section under the item',
    'op read op://ops/billing/keys/token',
    'op://ops/billing/keys/token',
  ],
  ['no field', 'API_TOKEN=op://ops/billing\n', 'op://ops/billing'],
  [
    'an escaped quote after it',
    String.raw`op read \"op://ops/billing/token\"`,
    String.raw`op://ops/billing/token\"`,
  ],
  [
    'a suffix past its field',
    'op read op://ops/billing/token$SUFFIX',
    'op://ops/billing/token$SUFFIX',
  ],
  [
    'text glued after a single quote',
    `op read 'op://ops/billing/token'-v2`,
    `op://ops/billing/token'-v2`,
  ],
  [
    'text glued after a double quote',
    'op read "op://ops/billing/token"-v2',
    'op://ops/billing/token"-v2',
  ],
  ['text glued after a backtick', 'see `op://ops/billing/token`s list', 'op://ops/billing/token`s'],
  [
    'a quoted fragment glued after a quote',
    `op read 'op://ops/billing/token'"-v2"`,
    `op://ops/billing/token'"-v2"`,
  ],
])('it reports an op:// occurrence with %s as unparsed', (_form, text, occurrence) => {
  expect(collectOPReferences(text)).toStrictEqual({ references: [], unparsed: [occurrence] });
});

test.each([
  ['a space', '# every value is an op:// reference\n'],
  ['a backtick', '- `.env` holds `op://` references\n'],
  ['the end of the text', 'the scheme is op://'],
])('it skips the scheme followed by %s, which names it in prose', (_form, text) => {
  expect(collectOPReferences(text)).toStrictEqual({ references: [], unparsed: [] });
});
