import { expect, test } from 'bun:test';
import { avatarCollection, userCollection } from './index';
import { resetMockDB } from './reset-mock-db';

test('it clears the collections it creates from the db barrel', async () => {
  await userCollection.create({});
  await avatarCollection.create({});

  resetMockDB();

  expect(userCollection.all()).toBeEmpty();
  expect(avatarCollection.all()).toBeEmpty();
});
