import { expect, test } from 'bun:test';
import { pickAetherNodeCodexMessage } from './pick-aether-node-codex-message';

test('it picks a calm message for a low difficulty', () => {
  expect(pickAetherNodeCodexMessage(1)).toBe('The aether is calm here, for now.');
});

test('it picks a wary message for a mid difficulty', () => {
  expect(pickAetherNodeCodexMessage(2)).toBe(
    'A faint hum lingers in this node, a remnant of some struggle long past.',
  );
});

test('it picks an ominous message for a high difficulty', () => {
  expect(pickAetherNodeCodexMessage(5)).toBe(
    'The aether here churns with old violence — tread carefully.',
  );
});
