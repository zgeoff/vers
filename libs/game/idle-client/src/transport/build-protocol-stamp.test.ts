import { expect, test } from 'bun:test';
import { buildProtocolStamp } from './build-protocol-stamp';

test('it derives one 64-hex stamp from the wire contract', () => {
  expect(buildProtocolStamp()).toMatch(/^[0-9a-f]{64}$/);
});

test('it derives the same stamp on every call', () => {
  expect(buildProtocolStamp()).toBe(buildProtocolStamp());
});
