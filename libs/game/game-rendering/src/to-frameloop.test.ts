import { expect, test } from 'bun:test';
import { toFrameloop } from './to-frameloop';

test('it stops the frameloop for a hidden presentation', () => {
  expect(toFrameloop('hidden')).toBe('never');
});

test('it keeps the frameloop always-on for a focus presentation', () => {
  expect(toFrameloop('focus')).toBe('always');
});

test('it keeps the frameloop always-on for an ambient presentation', () => {
  expect(toFrameloop('ambient')).toBe('always');
});
