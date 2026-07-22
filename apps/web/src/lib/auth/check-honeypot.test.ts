import { expect, spyOn, test } from 'bun:test';
import { updateEnv } from '@vers/test-utils/bun';
import { logger } from '../../server/logger';
import { checkHoneypot } from './check-honeypot';
import { HONEYPOT_FIELD_NAME, HONEYPOT_VALID_FROM_FIELD_NAME } from './honeypot-field-names';

test('it passes a submission with an empty honeypot field', () => {
  const formData = new FormData();

  formData.set(HONEYPOT_FIELD_NAME, '');

  expect(() => {
    checkHoneypot(formData);
  }).not.toThrow();
});

test('it flags a submission with a filled-in honeypot field', () => {
  const formData = new FormData();

  formData.set(HONEYPOT_FIELD_NAME, 'a bot filled this in');

  expect(() => {
    checkHoneypot(formData);
  }).toThrowWithMessage(Error, 'Form not submitted properly');
});

test('it logs a spam flag with its reason', () => {
  const warnSpy = spyOn(logger, 'warn');

  const formData = new FormData();

  formData.set(HONEYPOT_FIELD_NAME, 'a bot filled this in');

  expect(() => {
    checkHoneypot(formData);
  }).toThrow();

  expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
    { reason: 'honeypot-field' },
    'form submission flagged as spam',
  );
});

test('it flags a submission whose valid-from field is an empty string outside test mode', () => {
  const formData = new FormData();

  formData.set(HONEYPOT_VALID_FROM_FIELD_NAME, '');

  updateEnv('NODE_ENV', 'production');

  expect(() => {
    checkHoneypot(formData);
  }).toThrowWithMessage(Error, 'Form not submitted properly');
});

test('it logs a timing spam flag with its reason outside test mode', () => {
  const warnSpy = spyOn(logger, 'warn');

  const formData = new FormData();

  formData.set(HONEYPOT_VALID_FROM_FIELD_NAME, String(Date.now() + 60_000));

  updateEnv('NODE_ENV', 'production');

  expect(() => {
    checkHoneypot(formData);
  }).toThrow();

  expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
    { reason: 'timing' },
    'form submission flagged as spam',
  );
});

test('it distinguishes an absent valid-from field from a too-early submission', () => {
  const warnSpy = spyOn(logger, 'warn');

  updateEnv('NODE_ENV', 'production');

  expect(() => {
    checkHoneypot(new FormData());
  }).toThrow();

  expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
    { reason: 'missing-valid-from' },
    'form submission flagged as spam',
  );
});

test('it passes a submission whose valid-from timestamp has already elapsed outside test mode', () => {
  const formData = new FormData();

  formData.set(HONEYPOT_VALID_FROM_FIELD_NAME, String(Date.now() - 60_000));

  updateEnv('NODE_ENV', 'production');

  expect(() => {
    checkHoneypot(formData);
  }).not.toThrow();
});

test('it flags a submission arriving before its form-render valid-from timestamp outside test mode', () => {
  const formData = new FormData();

  formData.set(HONEYPOT_VALID_FROM_FIELD_NAME, String(Date.now() + 60_000));

  updateEnv('NODE_ENV', 'production');

  expect(() => {
    checkHoneypot(formData);
  }).toThrowWithMessage(Error, 'Form not submitted properly');
});
