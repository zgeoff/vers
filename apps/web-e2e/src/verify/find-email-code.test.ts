import { expect, test } from 'bun:test';
import { findEmailCode } from './find-email-code';

test('it reads the code of the last email', () => {
  const found = findEmailCode([
    { subject: 'Welcome to vers', html: '', text: 'Welcome to vers. Verification code: OLD123' },
    { subject: 'Welcome again', html: '', text: 'Welcome to vers. Verification code: NEW456' },
  ]);

  expect(found).toStrictEqual({ subject: 'Welcome again', code: 'NEW456' });
});

test('it finds no code when no email arrived', () => {
  expect(findEmailCode([])).toBeNull();
});

test('it finds no code in an email that carries none', () => {
  expect(
    findEmailCode([{ subject: 'Your weekly digest', html: '', text: 'Nothing new.' }]),
  ).toBeNull();
});
