import { expect, test } from 'bun:test';
import { createID } from './create-id';

test('it returns an ID with the correct length', () => {
  const id = createID();

  expect(id).toHaveLength(6);
});
