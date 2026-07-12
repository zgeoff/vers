import { expect, test } from 'bun:test';
import { createRNG } from '@vers/game-utils';
import { createGenesisSeed } from './create-genesis-seed';

test('it returns a 32-char lowercase-hex string', () => {
  expect(createGenesisSeed()).toMatch(/^[0-9a-f]{32}$/);
});

test('it is accepted by createRNG without throwing', () => {
  expect(() => createRNG(createGenesisSeed())).not.toThrow();
});

test('it differs across two calls', () => {
  expect(createGenesisSeed()).not.toBe(createGenesisSeed());
});
