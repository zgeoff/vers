import { expect, test } from 'bun:test';
import { buildChromePaths } from './build-chrome-paths';

test('it keeps the browser state under XDG_STATE_HOME', () => {
  expect(buildChromePaths('/var/state', '/home/tester')).toStrictEqual({
    directory: '/var/state/vers/qa-chrome',
    logFile: '/var/state/vers/qa-chrome/chrome.log',
    profileDir: '/var/state/vers/qa-chrome/profile',
    stateFile: '/var/state/vers/qa-chrome/state.json',
  });
});

test.each([
  ['unset', undefined],
  ['empty', ''],
])('it falls back to ~/.local/state when XDG_STATE_HOME is %s', (_label, xdgStateHome) => {
  expect(buildChromePaths(xdgStateHome, '/home/tester').directory).toBe(
    '/home/tester/.local/state/vers/qa-chrome',
  );
});
