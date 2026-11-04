import { expect, test } from 'bun:test';
import { buildOfflineHoldPaths } from './build-offline-hold-paths';

test('it keeps one state file and one lock file per target under XDG_STATE_HOME', () => {
  expect(buildOfflineHoldPaths('/var/state', '/home/tester', 'C0FFEE12')).toStrictEqual({
    directory: '/var/state/vers/qa-cdp/offline',
    lockFile: '/var/state/vers/qa-cdp/offline/C0FFEE12.lock',
    stateFile: '/var/state/vers/qa-cdp/offline/C0FFEE12.json',
  });
});

test('it keeps a target ID with a path separator inside the state directory', () => {
  expect(buildOfflineHoldPaths('/var/state', '/home/tester', '../escape').stateFile).toBe(
    '/var/state/vers/qa-cdp/offline/..%2Fescape.json',
  );
});
