import { expect, test } from 'bun:test';
import { updateEnv } from '@vers/test-utils/bun';
import { readServedCommit } from './read-served-commit';

test('it reads the commit the deploy stamped', () => {
  updateEnv('GIT_SHA', '4f0c2e9a7b1d3c5e8f6a');

  expect(readServedCommit()).toBe('4f0c2e9a7b1d3c5e8f6a');
});

test('it reads no commit when the deploy stamped none', () => {
  updateEnv('GIT_SHA', undefined);

  expect(readServedCommit()).toBeNull();
});

test.each(['main', '4f0c2e', 'not-a-commit-4f0c2e9'])(
  'it reads no commit when GIT_SHA is %p',
  (value) => {
    updateEnv('GIT_SHA', value);

    expect(readServedCommit()).toBeNull();
  },
);
