import { expect, test } from 'bun:test';
import { buildStateHome } from './build-state-home';

test('it returns XDG_STATE_HOME when it is set', () => {
  expect(buildStateHome('/var/state', '/home/tester')).toBe('/var/state');
});

test.each([
  ['unset', undefined],
  ['empty', ''],
])('it falls back to ~/.local/state when XDG_STATE_HOME is %s', (_label, xdgStateHome) => {
  expect(buildStateHome(xdgStateHome, '/home/tester')).toBe('/home/tester/.local/state');
});
