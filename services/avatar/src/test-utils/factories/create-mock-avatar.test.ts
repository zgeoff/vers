import { expect, test } from 'bun:test';
import { createMockAvatar } from './create-mock-avatar';

test('it builds a default avatar row', () => {
  const row = createMockAvatar();

  expect(row).toStrictEqual({
    class: 'brute',
    id: expect.toBeString(),
    name: expect.toBeString(),
    userId: expect.toBeString(),
  });
});

test('it applies overrides on top of the defaults', () => {
  const row = createMockAvatar({ class: 'scholar', name: 'Fixedname', userId: 'user_1' });

  expect(row).toStrictEqual({
    class: 'scholar',
    id: expect.toBeString(),
    name: 'Fixedname',
    userId: 'user_1',
  });
});
