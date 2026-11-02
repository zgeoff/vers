import { expect, test } from 'bun:test';
import { buildCutCommands } from './build-cut-commands';

test('it keeps the IPv6 addresses of an interface with IPv6 routes, then takes it down', () => {
  expect(
    buildCutCommands({
      interfaceName: 'eth0',
      routes: [
        {
          dev: 'eth0',
          dst: '2001:db8::7/128',
          family: 'inet6',
          gateway: null,
          isOnlink: false,
          metric: 256,
          prefsrc: null,
          protocol: 'kernel',
          scope: null,
        },
      ],
    }),
  ).toStrictEqual([
    ['sysctl', '-w', 'net.ipv6.conf.eth0.keep_addr_on_down=1'],
    ['ip', 'link', 'set', 'dev', 'eth0', 'down'],
  ]);
});

test('it only takes down an interface with no IPv6 routes', () => {
  expect(
    buildCutCommands({
      interfaceName: 'eth0',
      routes: [
        {
          dev: 'eth0',
          dst: 'default',
          family: 'inet',
          gateway: '10.20.0.1',
          isOnlink: false,
          metric: null,
          prefsrc: null,
          protocol: 'kernel',
          scope: null,
        },
      ],
    }),
  ).toStrictEqual([['ip', 'link', 'set', 'dev', 'eth0', 'down']]);
});
