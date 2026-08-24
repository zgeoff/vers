import { expect, test } from 'bun:test';
import { buildHeadingPattern } from './build-heading-pattern';

test('it matches the heading carrying the title', () => {
  expect(buildHeadingPattern('Scope').test('## Scope')).toBe(true);
});

test('it matches the heading regardless of case', () => {
  expect(buildHeadingPattern('Player story').test('## Player Story')).toBe(true);
});

test('it matches a heading among surrounding lines', () => {
  expect(buildHeadingPattern('Notes').test('a lead paragraph\n\n## Notes\n\n- a note')).toBe(true);
});

test('it treats a parenthesised title as literal text', () => {
  const pattern = buildHeadingPattern('Approach (unverified)');

  expect(pattern.test('## Approach (unverified)')).toBe(true);
  expect(pattern.test('## Approach unverified')).toBe(false);
});

test('it rejects a heading at another level', () => {
  expect(buildHeadingPattern('Scope').test('### Scope')).toBe(false);
});
