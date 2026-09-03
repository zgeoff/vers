import { expect, test } from 'bun:test';
import {
  renderChangeEmailVerificationEmail,
  renderResetPasswordEmail,
  renderTwoFactorEmail,
  renderWelcomeEmail,
} from '@vers/email';
import { findVerification } from './find-verification';

test('it reads the sign-up code and link out of the welcome email', () => {
  const email = renderWelcomeEmail({
    verificationCode: 'AB3CD9',
    verificationURL:
      'https://versidle.com/verify-otp?code=AB3CD9&target=qa%2B1%40qa.versidle.com&type=onboarding',
  });

  expect(findVerification({ html: email.html, text: email.plainText }, 'welcome')).toStrictEqual({
    code: 'AB3CD9',
    kind: 'welcome',
    url: 'https://versidle.com/verify-otp?code=AB3CD9&target=qa%2B1%40qa.versidle.com&type=onboarding',
  });
});

test('it reads the change-email code and link out of the change-email verification email', () => {
  const email = renderChangeEmailVerificationEmail({
    newEmail: 'new@qa.versidle.com',
    verificationCode: 'ZY7XW2',
    verificationURL:
      'https://versidle.com/verify-otp?code=ZY7XW2&target=new%40qa.versidle.com&type=change-email',
  });

  expect(
    findVerification({ html: email.html, text: email.plainText }, 'change-email'),
  ).toStrictEqual({
    code: 'ZY7XW2',
    kind: 'change-email',
    url: 'https://versidle.com/verify-otp?code=ZY7XW2&target=new%40qa.versidle.com&type=change-email',
  });
});

test('it reads the reset link out of the reset-password email', () => {
  const email = renderResetPasswordEmail({
    resetURL: `https://versidle.com/reset-password?email=qa%2B1%40qa.versidle.com&token=${'a'.repeat(64)}`,
  });

  expect(
    findVerification({ html: email.html, text: email.plainText }, 'reset-password'),
  ).toStrictEqual({
    code: null,
    kind: 'reset-password',
    url: `https://versidle.com/reset-password?email=qa%2B1%40qa.versidle.com&token=${'a'.repeat(64)}`,
  });
});

test('it reads the sign-in code out of the two-factor email', () => {
  const email = renderTwoFactorEmail({ verificationCode: '482913' });

  expect(findVerification({ html: email.html, text: email.plainText }, 'two-factor')).toStrictEqual(
    { code: '482913', kind: 'two-factor', url: null },
  );
});

test('it reads the link out of the html when the email carries no plain text', () => {
  const email = renderWelcomeEmail({
    verificationCode: 'AB3CD9',
    verificationURL:
      'https://versidle.com/verify-otp?code=AB3CD9&target=qa%2B1%40qa.versidle.com&type=onboarding',
  });

  expect(findVerification({ html: email.html, text: '' }, 'welcome')).toStrictEqual({
    code: 'AB3CD9',
    kind: 'welcome',
    url: 'https://versidle.com/verify-otp?code=AB3CD9&target=qa%2B1%40qa.versidle.com&type=onboarding',
  });
});

test('it reads the code out of the text when the welcome email carries no link', () => {
  const found = findVerification(
    { html: '', text: 'WELCOME TO VERS\n\nOr enter the following verification code:\n\nAB3CD9' },
    'welcome',
  );

  expect(found).toStrictEqual({ code: 'AB3CD9', kind: 'welcome', url: null });
});

test('it tells the kind apart when asked for any', () => {
  const email = renderChangeEmailVerificationEmail({
    newEmail: 'new@qa.versidle.com',
    verificationCode: 'ZY7XW2',
    verificationURL:
      'https://versidle.com/verify-otp?code=ZY7XW2&target=new%40qa.versidle.com&type=change-email',
  });

  expect(findVerification({ html: email.html, text: email.plainText }, 'any')).toMatchObject({
    code: 'ZY7XW2',
    kind: 'change-email',
  });
});

test('it misses when the email is of another kind', () => {
  const email = renderTwoFactorEmail({ verificationCode: '482913' });

  expect(findVerification({ html: email.html, text: email.plainText }, 'welcome')).toBeNull();
});

test('it misses when the email carries no verification at all', () => {
  expect(
    findVerification({ html: '<p>Your vers password was changed</p>', text: '' }, 'any'),
  ).toBeNull();
});
