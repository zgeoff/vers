import { expect, test } from 'bun:test';
import { createMockAvatar } from './create-mock-avatar';

test('it builds a plain, unpersisted avatar row with a valid class and faker-generated name', () => {
  const row = createMockAvatar();

  expect(row.class).toBe('brute');
  expect(row.name).toMatch(/^[a-z]+$/);
  expect(row.name.length).toBeWithin(6, 13);
});

test('it defaults userId to a random id rather than requiring a parent user', () => {
  const first = createMockAvatar();
  const second = createMockAvatar();

  expect(first.userId).not.toBe(second.userId);
});

test('it applies overrides on top of the faker defaults', () => {
  const row = createMockAvatar({ class: 'scholar', name: 'Fixedname', userId: 'user_1' });

  expect(row).toMatchObject({ class: 'scholar', name: 'Fixedname', userId: 'user_1' });
});
