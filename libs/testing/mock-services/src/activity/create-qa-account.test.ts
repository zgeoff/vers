import { expect, test } from 'bun:test';
import { call } from '@orpc/server';
import { createQAAccount } from './create-qa-account';

test('it stores a QA account whose QA avatar sits at the requested level', async () => {
  const account = await call(
    createQAAccount,
    { level: 4, password: 'quiet-harbour-41', runs: 1, twoFactor: false, user: 'qa-heron' },
    { context: { actingUserID: null } },
  );

  expect(account).toStrictEqual({
    avatar: { id: expect.toBeString(), level: 4, name: expect.toBeString(), xp: 0 },
    password: 'quiet-harbour-41',
    runs: [],
    twoFactor: null,
    user: { email: 'qa-heron@qa.versidle.com', id: expect.toBeString(), username: 'qa-heron' },
  });
});

test('it refuses an address it already holds with CONFLICT', async () => {
  await call(
    createQAAccount,
    { level: 1, runs: 0, twoFactor: false, user: 'qa-egret' },
    { context: { actingUserID: null } },
  );

  expect(
    call(
      createQAAccount,
      { level: 1, runs: 0, twoFactor: false, user: 'qa-egret' },
      { context: { actingUserID: null } },
    ),
  ).rejects.toMatchObject({ code: 'CONFLICT' });
});
