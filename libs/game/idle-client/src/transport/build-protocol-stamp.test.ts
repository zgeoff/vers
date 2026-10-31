import { expect, test } from 'bun:test';
import { buildProtocolStamp } from './build-protocol-stamp';

test('it derives one 64-hex stamp from the wire contract', () => {
  expect(buildProtocolStamp()).toMatch(/^[0-9a-f]{64}$/u);
});

test('it derives the stamp of the current wire contract', () => {
  expect(buildProtocolStamp()).toMatchInlineSnapshot(
    `"436e8a39735c393aae09c4264e4a138facede1254631c60954229354fb333fb8"`,
  );
});

test('it derives the same stamp on every call', () => {
  expect(buildProtocolStamp()).toBe(buildProtocolStamp());
});
