import { expect, test } from 'bun:test';
import { ScopeIdentifierSchema } from './scope-identifier-schema';

test('it accepts a path-safe identifier', () => {
  expect(ScopeIdentifierSchema.safeParse('world_map_node.node-1').success).toBe(true);
});

test('it rejects an empty identifier', () => {
  const result = ScopeIdentifierSchema.safeParse('');

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.path).toStrictEqual([]);
});

test('it rejects an identifier past the length bound', () => {
  const result = ScopeIdentifierSchema.safeParse('a'.repeat(129));

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.path).toStrictEqual([]);
});

test('it rejects an identifier containing the position separator', () => {
  const result = ScopeIdentifierSchema.safeParse('node|1');

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.code).toBe('invalid_format');
});

test('it rejects an identifier with a whitespace character', () => {
  const result = ScopeIdentifierSchema.safeParse('node 1');

  expect(result.success).toBe(false);
  expect(result.error?.issues[0]?.code).toBe('invalid_format');
});
