import { expect, test } from 'bun:test';
import { parseOPReferencePath } from './parse-op-reference-path';

test.each([
  [
    'a vault, item and field',
    'ops/billing/token',
    { field: 'token', item: 'billing', vault: 'ops' },
  ],
  [
    'a field under a section',
    'ops/billing/keys/token',
    { field: 'keys/token', item: 'billing', vault: 'ops' },
  ],
  [
    'a query after the field',
    'ops/billing/code?attribute=otp',
    { field: 'code', item: 'billing', vault: 'ops' },
  ],
  [
    'quotes inside the item',
    `ops/Billing's "prod"/token`,
    { field: 'token', item: `Billing's "prod"`, vault: 'ops' },
  ],
])('it parses %s', (_form, path, reference) => {
  expect(parseOPReferencePath(path)).toStrictEqual(reference);
});

test.each([
  ['no field', 'ops/billing'],
  ['an empty item', 'ops//token'],
  ['too many segments', 'ops/billing/keys/nested/token'],
  ['a variable', 'ops/$ITEM/token'],
  ['a template brace', 'ops/{item}/token'],
])('it rejects a path with %s', (_form, path) => {
  expect(parseOPReferencePath(path)).toBeNull();
});
