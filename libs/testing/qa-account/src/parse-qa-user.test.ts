import { expect, test } from 'bun:test';
import { parseQAUser } from './parse-qa-user';

test('it builds the QA address, username, and avatar name from a bare account name', () => {
  expect(parseQAUser('qa-007')).toStrictEqual({
    kind: 'parsed',
    user: {
      avatarName: 'qaaah',
      email: 'qa-007@qa.versidle.com',
      name: 'qa-007',
      username: 'qa_007',
    },
  });
});

test('it accepts a full address on the QA domain and lowercases it', () => {
  expect(parseQAUser('QA+Signup-1@QA.versidle.com')).toStrictEqual({
    kind: 'parsed',
    user: {
      avatarName: 'qasignupb',
      email: 'qa+signup-1@qa.versidle.com',
      name: 'qa+signup-1',
      username: 'qa_signup_1',
    },
  });
});

test('it caps the username and avatar name at their contract lengths', () => {
  expect(parseQAUser('abcdefghijklmnopqrstuvwxyz')).toStrictEqual({
    kind: 'parsed',
    user: {
      avatarName: 'abcdefghijklmnop',
      email: 'abcdefghijklmnopqrstuvwxyz@qa.versidle.com',
      name: 'abcdefghijklmnopqrstuvwxyz',
      username: 'abcdefghijklmnopqrst',
    },
  });
});

test.each([
  { raw: 'player@versidle.com', reason: /only addresses under qa\.versidle\.com/u },
  { raw: 'qa 007', reason: /invalid QA account name/u },
  { raw: '@qa.versidle.com', reason: /invalid QA account name/u },
  { raw: 'q1', reason: /no valid avatar name/u },
])('it refuses $raw', (row) => {
  expect(parseQAUser(row.raw)).toStrictEqual({
    kind: 'refused',
    reason: expect.stringMatching(row.reason),
  });
});
