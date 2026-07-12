import { expect, test } from 'bun:test';
import { SendWelcomeInputSchema } from './send-welcome-input-schema';

test('it accepts a well-formed welcome input', () => {
  const result = SendWelcomeInputSchema.safeParse({
    to: 'player@example.com',
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify',
  });

  expect(result.success).toBeTrue();
});

test('it rejects a to address that is not a valid email', () => {
  const result = SendWelcomeInputSchema.safeParse({
    to: 'not-an-email',
    verificationCode: '123456',
    verificationURL: 'https://versidle.com/verify',
  });

  expect(result.success).toBeFalse();
});

test('it rejects a verificationURL that is not a valid url', () => {
  const result = SendWelcomeInputSchema.safeParse({
    to: 'player@example.com',
    verificationCode: '123456',
    verificationURL: 'not-a-url',
  });

  expect(result.success).toBeFalse();
});
