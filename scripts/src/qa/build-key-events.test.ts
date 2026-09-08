import { expect, test } from 'bun:test';
import { buildKeyEvents } from './build-key-events';

test('it gives Enter its virtual key code and the carriage return a form submit needs', () => {
  expect(buildKeyEvents('Enter')).toStrictEqual([
    { code: 'Enter', key: 'Enter', text: '\r', type: 'keyDown', windowsVirtualKeyCode: 13 },
    { code: 'Enter', key: 'Enter', type: 'keyUp', windowsVirtualKeyCode: 13 },
  ]);
});

test('it passes a key with no known code through as a down and an up', () => {
  expect(buildKeyEvents('ArrowDown')).toStrictEqual([
    { code: 'ArrowDown', key: 'ArrowDown', type: 'keyDown' },
    { code: 'ArrowDown', key: 'ArrowDown', type: 'keyUp' },
  ]);
});
