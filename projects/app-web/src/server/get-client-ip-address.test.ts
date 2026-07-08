import { expect, test } from 'bun:test';
import { getClientIPAddress } from './get-client-ip-address';

test('it prefers the fly-client-ip header', () => {
  const request = new Request('https://example.test/', {
    headers: { 'fly-client-ip': '203.0.113.1', 'x-forwarded-for': '198.51.100.1' },
  });

  expect(getClientIPAddress(request)).toBe('203.0.113.1');
});

test('it falls back to the first x-forwarded-for entry', () => {
  const request = new Request('https://example.test/', {
    headers: { 'x-forwarded-for': '198.51.100.1, 10.0.0.1' },
  });

  expect(getClientIPAddress(request)).toBe('198.51.100.1');
});

test('it falls back to the runtime-reported ip when no headers are set', () => {
  const request: Request & { ip?: string } = new Request('https://example.test/');

  request.ip = '192.0.2.1';

  expect(getClientIPAddress(request)).toBe('192.0.2.1');
});

test('it returns an empty string when no address is available', () => {
  expect(getClientIPAddress(new Request('https://example.test/'))).toBe('');
});
