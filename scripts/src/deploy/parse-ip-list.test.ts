import { expect, test } from 'bun:test';
import { parseIPList } from './parse-ip-list';

test('it reads a private flycast address as private', () => {
  const json = [{ Address: 'fdaa:97:5621:0:1::4', Type: 'private_v6' }];

  expect(parseIPList(json)).toStrictEqual([{ address: 'fdaa:97:5621:0:1::4', type: 'private' }]);
});

test('it reads a dedicated public v6 address as public', () => {
  const json = [{ Address: '2a09:8280:1::145:fe12:0', Type: 'v6' }];

  expect(parseIPList(json)).toStrictEqual([{ address: '2a09:8280:1::145:fe12:0', type: 'public' }]);
});

test('it reads a shared public v4 address as public', () => {
  const json = [{ Address: '66.241.124.240', Type: 'shared_v4' }];

  expect(parseIPList(json)).toStrictEqual([{ address: '66.241.124.240', type: 'public' }]);
});

test('it treats an unrecognized type as public', () => {
  const json = [{ Address: '203.0.113.9', Type: 'dedicated_v4' }];

  expect(parseIPList(json)).toStrictEqual([{ address: '203.0.113.9', type: 'public' }]);
});

test('it parses an app with no allocated addresses', () => {
  expect(parseIPList([])).toStrictEqual([]);
});

test('it parses a null document as no allocated addresses', () => {
  expect(parseIPList(null)).toStrictEqual([]);
});

test('it reads every address a multi-homed app carries', () => {
  const json = [
    { Address: '2a09:8280:1::14b:e98a:0', Type: 'v6' },
    { Address: '66.241.125.186', Type: 'shared_v4' },
  ];

  expect(parseIPList(json)).toStrictEqual([
    { address: '2a09:8280:1::14b:e98a:0', type: 'public' },
    { address: '66.241.125.186', type: 'public' },
  ]);
});
