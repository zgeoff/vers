import { expect, test } from 'bun:test';
import { UserDataSchema } from './user-data-schema';

test('it accepts a well-formed user', () => {
  const result = UserDataSchema.safeParse({
    createdAt: new Date(),
    email: 'person@example.com',
    id: 'user_1',
    name: 'Bob Bobson',
    seed: 42,
    updatedAt: new Date(),
    username: 'bobby',
  });

  expect(result.success).toBeTrue();
});

test('it rejects a user missing required fields', () => {
  const result = UserDataSchema.safeParse({ id: 'user_1' });

  expect(result.success).toBeFalse();
  expect(result.error?.issues).toPartiallyContain(expect.objectContaining({ path: ['createdAt'] }));
});

test('it strips password fields instead of passing them through', () => {
  const parsed = UserDataSchema.parse({
    createdAt: new Date(),
    email: 'person@example.com',
    id: 'user_1',
    name: 'Bob Bobson',
    passwordHash: 'should-not-be-here',
    seed: 42,
    updatedAt: new Date(),
    username: 'bobby',
  });

  expect('passwordHash' in parsed).toBeFalse();
});
