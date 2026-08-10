import { expect, test } from 'bun:test';
import { createMockAvatar } from './create-mock-avatar';

test('it builds a default avatar row', () => {
  const row = createMockAvatar();

  expect(row).toStrictEqual({
    id: expect.toBeString(),
    mode: 'trade',
    name: expect.toBeString(),
    seed: expect.toBeNumber(),
    userId: expect.toBeString(),
  });
});

test('it applies overrides on top of the defaults', () => {
  const row = createMockAvatar({ mode: 'self_found', name: 'Fixedname', userId: 'user_1' });

  expect(row).toStrictEqual({
    id: expect.toBeString(),
    mode: 'self_found',
    name: 'Fixedname',
    seed: expect.toBeNumber(),
    userId: 'user_1',
  });
});
