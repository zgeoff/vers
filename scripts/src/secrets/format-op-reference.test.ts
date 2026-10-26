import { expect, test } from 'bun:test';
import { formatOPReference } from './format-op-reference';

test('it formats a reference as the op:// URI that op read takes', () => {
  expect(formatOPReference({ field: 'api-key', item: 'billing', vault: 'ops' })).toBe(
    'op://ops/billing/api-key',
  );
});
