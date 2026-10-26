import { expect, test } from 'bun:test';
import { collectOPReferences } from './collect-op-references';

test('it collects each reference in an env file', () => {
  expect(
    collectOPReferences('API_KEY=op://ops/billing/api-key\nREGION=op://ops/billing/region\n'),
  ).toStrictEqual([
    { field: 'api-key', item: 'billing', vault: 'ops' },
    { field: 'region', item: 'billing', vault: 'ops' },
  ]);
});

test('it collects a quoted reference inside a shell command', () => {
  expect(
    collectOPReferences(`TOKEN="$(op read 'op://ops/tracker/mcp-token')" exec ./tracker-mcp`),
  ).toStrictEqual([{ field: 'mcp-token', item: 'tracker', vault: 'ops' }]);
});

test('it skips a reference that interpolates a segment', () => {
  expect(collectOPReferences(`${String.raw`op read op://ops/$`}{item}/dsn`)).toStrictEqual([]);
});

test('it skips a bare scheme with no path', () => {
  expect(collectOPReferences('values are `op://` references')).toStrictEqual([]);
});
