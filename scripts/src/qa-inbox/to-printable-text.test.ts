import { expect, test } from 'bun:test';
import { toPrintableText } from './to-printable-text';

test('it removes terminal control characters and folds line breaks into spaces', () => {
  expect(toPrintableText('Welcome\u001B[31m to\r\nvers\tnow\u0085!')).toBe(
    'Welcome[31m to vers now!',
  );
});

test('it keeps line breaks when asked', () => {
  expect(toPrintableText('line one\nline two\u0007', { keepLineBreaks: true })).toBe(
    'line one\nline two',
  );
});

test('it leaves ordinary text alone', () => {
  expect(toPrintableText('Reset your vers password')).toBe('Reset your vers password');
});
