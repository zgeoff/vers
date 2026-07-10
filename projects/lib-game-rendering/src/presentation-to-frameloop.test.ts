import { expect, test } from 'bun:test';
import { presentationToFrameloop } from './presentation-to-frameloop';

test('it stops the frameloop for a hidden presentation', () => {
  expect(presentationToFrameloop('hidden')).toBe('never');
});

test('it keeps the frameloop always-on for a focus presentation', () => {
  expect(presentationToFrameloop('focus')).toBe('always');
});

test('it keeps the frameloop always-on for an ambient presentation', () => {
  expect(presentationToFrameloop('ambient')).toBe('always');
});
