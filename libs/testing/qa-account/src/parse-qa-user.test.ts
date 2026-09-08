import { expect, test } from 'bun:test';
import { parseQAUser } from './parse-qa-user';

test('it builds the QA address, username, and avatar name from a bare account name', () => {
  expect(parseQAUser('qa-007')).toStrictEqual({
    avatarName: 'qaaah',
    email: 'qa-007@qa.versidle.com',
    name: 'qa-007',
    username: 'qa_007',
  });
});

test('it accepts a full address on the QA domain and lowercases it', () => {
  expect(parseQAUser('QA+Signup-1@QA.versidle.com')).toStrictEqual({
    avatarName: 'qasignupb',
    email: 'qa+signup-1@qa.versidle.com',
    name: 'qa+signup-1',
    username: 'qa_signup_1',
  });
});

test('it caps the username and avatar name at their contract lengths', () => {
  const parsed = parseQAUser('abcdefghijklmnopqrstuvwxyz');

  expect(parsed.username).toBe('abcdefghijklmnopqrst');
  expect(parsed.avatarName).toBe('abcdefghijklmnop');
});

test('it refuses an address outside the QA domain', () => {
  expect(() => parseQAUser('player@versidle.com')).toThrowWithMessage(
    Error,
    /only addresses under qa\.versidle\.com/,
  );
});

test('it refuses an account name with characters outside the allowed set', () => {
  expect(() => parseQAUser('qa 007')).toThrowWithMessage(Error, /invalid QA account name/);
});

test('it refuses an empty account name', () => {
  expect(() => parseQAUser('@qa.versidle.com')).toThrowWithMessage(
    Error,
    /invalid QA account name/,
  );
});

test('it refuses a name too short to yield a valid avatar name', () => {
  expect(() => parseQAUser('q1')).toThrowWithMessage(Error, /no valid avatar name/);
});
