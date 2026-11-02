import { expect, test } from 'bun:test';
import { pickNetworkTarget } from './pick-network-target';

test('it refuses when no browser runs', () => {
  expect(pickNetworkTarget(undefined)).toStrictEqual({ kind: 'no-browser' });
});

test('it refuses a browser that runs without a namespace', () => {
  expect(
    pickNetworkTarget({ leaderPID: 4100, leaderStartTime: '880', namespace: null, port: 9222 }),
  ).toStrictEqual({ kind: 'no-namespace' });
});

test('it targets the namespace of a browser that runs in one', () => {
  const state = {
    leaderPID: 4100,
    leaderStartTime: '880',
    namespace: { cut: null, holderPID: 4102 },
    port: 9222,
  };

  expect(pickNetworkTarget(state)).toStrictEqual({
    kind: 'ready',
    namespace: { cut: null, holderPID: 4102 },
    state,
  });
});
