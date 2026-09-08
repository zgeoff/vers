import { expect, test } from 'bun:test';
import { parseEndpoint } from './parse-endpoint';

test('it accepts a host and port', () => {
  expect(parseEndpoint('172.28.80.1:9223')).toBe('172.28.80.1:9223');
});

test('it rejects a value with a scheme or a path', () => {
  expect(() => parseEndpoint('http://127.0.0.1:9222')).toThrowWithMessage(Error, /host:port/);
  expect(() => parseEndpoint('127.0.0.1:9222/json')).toThrowWithMessage(Error, /host:port/);
});

test('it rejects a port outside 1 to 65535', () => {
  expect(() => parseEndpoint('127.0.0.1:0')).toThrowWithMessage(Error, /1 to 65535/);
  expect(() => parseEndpoint('127.0.0.1:65536')).toThrowWithMessage(Error, /1 to 65535/);
});

test('it rejects a value with no port', () => {
  expect(() => parseEndpoint('127.0.0.1')).toThrowWithMessage(Error, /host:port/);
});

test('it rejects a host that carries a url delimiter', () => {
  expect(() => parseEndpoint('127.0.0.1#x:9222')).toThrowWithMessage(Error, /host:port/);
  expect(() => parseEndpoint('host?x:9222')).toThrowWithMessage(Error, /host:port/);
  expect(() => parseEndpoint('localhost@other-host:9222')).toThrowWithMessage(Error, /host:port/);
});

test('it accepts a hostname with dots and dashes', () => {
  expect(parseEndpoint('host.docker-internal.test:9222')).toBe('host.docker-internal.test:9222');
});
