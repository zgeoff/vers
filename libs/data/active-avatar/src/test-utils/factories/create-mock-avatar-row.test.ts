import { expect, test } from 'bun:test';
import { createMockAvatarRow } from './create-mock-avatar-row';

test('it builds a default avatar row', () => {
  const row = createMockAvatarRow();

  expect(row).toStrictEqual({
    id: expect.toBeString(),
    mode: 'trade',
    name: expect.toBeString(),
    userId: expect.toBeString(),
  });
});

test('it applies overrides on top of the defaults', () => {
  const row = createMockAvatarRow({ mode: 'self_found', name: 'Fixedname', userId: 'user_1' });

  expect(row).toStrictEqual({
    id: expect.toBeString(),
    mode: 'self_found',
    name: 'Fixedname',
    userId: 'user_1',
  });
});
