import { expect, test } from 'bun:test';
import { readCurrentBranch } from './read-current-branch';

test('it reads the checked-out branch name of the current worktree', () => {
  expect(readCurrentBranch()).not.toBeEmpty();
});
