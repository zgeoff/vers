import { expect, test } from 'bun:test';
import { pickWorldMapNodeCodexMessage } from './pick-world-map-node-codex-message';

test('it picks a calm message for a low difficulty', () => {
  expect(pickWorldMapNodeCodexMessage(1)).toBe('The world is calm here, for now.');
});

test('it picks a wary message for a mid difficulty', () => {
  expect(pickWorldMapNodeCodexMessage(2)).toBe(
    'A faint hum lingers in this node, a remnant of some struggle long past.',
  );
});

test('it picks an ominous message for a high difficulty', () => {
  expect(pickWorldMapNodeCodexMessage(5)).toBe(
    'The world here churns with old violence — tread carefully.',
  );
});
