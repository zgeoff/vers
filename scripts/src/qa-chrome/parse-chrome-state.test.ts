import { expect, test } from 'bun:test';
import { parseChromeState } from './parse-chrome-state';

test('it reads a state with a cut network', () => {
  const state = {
    leaderPID: 4100,
    leaderStartTime: '880',
    namespace: {
      cut: {
        interfaceName: 'eth0',
        routes: [
          {
            dev: 'eth0',
            dst: 'default',
            family: 'inet' as const,
            gateway: '10.20.0.1',
            isOnlink: true,
            metric: null,
            prefsrc: null,
            protocol: 'kernel',
            scope: null,
          },
        ],
      },
      holderPID: 4102,
    },
    port: 9222,
  };

  expect(parseChromeState(JSON.stringify(state))).toStrictEqual(state);
});

test('it rejects a state whose port is out of range', () => {
  const text = JSON.stringify({
    leaderPID: 4100,
    leaderStartTime: '880',
    namespace: null,
    port: 70_000,
  });

  expect(() => parseChromeState(text)).toThrow();
});
