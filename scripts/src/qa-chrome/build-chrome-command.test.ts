import { expect, test } from 'bun:test';
import { buildChromeCommand } from './build-chrome-command';

test('it runs chromium directly without a namespace', () => {
  expect(
    buildChromeCommand({
      chromiumPath: '/usr/bin/chromium',
      namespace: null,
      port: 9222,
      profileDir: '/state/profile',
    }),
  ).toStrictEqual([
    '/usr/bin/chromium',
    '--headless=new',
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    '--user-data-dir=/state/profile',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);
});

test('it runs chromium under pasta as the user, with the DevTools port on the namespace loopback', () => {
  expect(
    buildChromeCommand({
      chromiumPath: '/usr/bin/chromium',
      namespace: { gid: 1001, pastaPath: '/usr/bin/pasta', uid: 1002 },
      port: 9333,
      profileDir: '/state/profile',
    }),
  ).toStrictEqual([
    '/usr/bin/pasta',
    '--config-net',
    '--host-lo-to-ns-lo',
    '--tcp-ports',
    '127.0.0.1/9333',
    '--udp-ports',
    'none',
    '--tcp-ns',
    'none',
    '--udp-ns',
    'none',
    '--',
    'sh',
    '-c',
    '"$@" & wait $!',
    'sh',
    'unshare',
    '--user',
    '--map-user=1002',
    '--map-group=1001',
    '/usr/bin/chromium',
    '--headless=new',
    '--remote-debugging-port=9333',
    '--remote-allow-origins=*',
    '--user-data-dir=/state/profile',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);
});
