import { expect, test } from 'bun:test';
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

test('it flags a submission whose valid-from field is an empty string outside test mode', () => {
  const formData = new FormData();

  formData.set(HONEYPOT_VALID_FROM_FIELD_NAME, '');

  const previousNodeEnv = process.env.NODE_ENV;

  process.env.NODE_ENV = 'production';

  try {
    expect(() => {
      checkHoneypot(formData);
    }).toThrowWithMessage(Error, 'Form not submitted properly');
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

test('it flags a submission arriving before its form-render valid-from timestamp outside test mode', () => {
  const formData = new FormData();

  formData.set(HONEYPOT_VALID_FROM_FIELD_NAME, String(Date.now() + 60_000));

  const previousNodeEnv = process.env.NODE_ENV;

  process.env.NODE_ENV = 'production';

  try {
    expect(() => {
      checkHoneypot(formData);
    }).toThrowWithMessage(Error, 'Form not submitted properly');
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});
