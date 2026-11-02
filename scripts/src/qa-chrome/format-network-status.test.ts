import { expect, test } from 'bun:test';
import { formatNetworkStatus } from './format-network-status';

test('it reports the default route of a network that is up', () => {
  expect(
    formatNetworkStatus({
      isLinkUp: null,
      namespace: { cut: null, holderPID: 4102 },
      routes: [
        {
          dev: 'eth0',
          dst: 'default',
          family: 'inet',
          gateway: '10.20.0.1',
          metric: null,
          prefsrc: null,
          protocol: 'kernel',
          scope: null,
        },
      ],
      state: {
        leaderPID: 4100,
        leaderStartTime: '880',
        namespace: { cut: null, holderPID: 4102 },
        port: 9222,
      },
    }),
  ).toBe(
    'browser: pid 4100, DevTools on 127.0.0.1:9222, namespace holder pid 4102\nnetwork: up — default route via 10.20.0.1 on eth0',
  );
});

test('it reports a cut network with its saved routes', () => {
  const namespace = {
    cut: {
      interfaceName: 'eth0',
      routes: [
        {
          dev: 'eth0',
          dst: 'default',
          family: 'inet' as const,
          gateway: '10.20.0.1',
          metric: null,
          prefsrc: null,
          protocol: 'kernel',
          scope: null,
        },
      ],
    },
    holderPID: 4102,
  };

  expect(
    formatNetworkStatus({
      isLinkUp: false,
      namespace,
      routes: [],
      state: { leaderPID: 4100, leaderStartTime: '880', namespace, port: 9222 },
    }),
  ).toBe(
    'browser: pid 4100, DevTools on 127.0.0.1:9222, namespace holder pid 4102\nnetwork: cut — eth0 is down, with 1 route saved for restore',
  );
});

test('it reports a cut whose link someone brought back up', () => {
  const namespace = { cut: { interfaceName: 'eth0', routes: [] }, holderPID: 4102 };

  expect(
    formatNetworkStatus({
      isLinkUp: true,
      namespace,
      routes: [],
      state: { leaderPID: 4100, leaderStartTime: '880', namespace, port: 9222 },
    }),
  ).toBe(
    'browser: pid 4100, DevTools on 127.0.0.1:9222, namespace holder pid 4102\nnetwork: cut — eth0 is up, so a restore is due, with 0 routes saved for restore',
  );
});

test('it reports a namespace with no default route', () => {
  const namespace = { cut: null, holderPID: 4102 };

  expect(
    formatNetworkStatus({
      isLinkUp: null,
      namespace,
      routes: [],
      state: { leaderPID: 4100, leaderStartTime: '880', namespace, port: 9222 },
    }),
  ).toBe(
    'browser: pid 4100, DevTools on 127.0.0.1:9222, namespace holder pid 4102\nnetwork: no default route in the namespace',
  );
});
