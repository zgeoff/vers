import { expect, test } from 'bun:test';
import { isQAAccountEmail } from './is-qa-account-email';

test('it accepts an address on the QA domain in any case', () => {
  expect(isQAAccountEmail('qa+signup-1@qa.versidle.com')).toBeTrue();
  expect(isQAAccountEmail('Tester@QA.Versidle.com')).toBeTrue();
});

test('it accepts an address on a subdomain of the QA domain', () => {
  expect(isQAAccountEmail('tester@night.qa.versidle.com')).toBeTrue();
});

test('it rejects the production domain and a look-alike', () => {
  expect(isQAAccountEmail('player@versidle.com')).toBeFalse();
  expect(isQAAccountEmail('player@notqa.versidle.com')).toBeFalse();
  expect(isQAAccountEmail('player@qa.versidle.com.evil.example')).toBeFalse();
});

test('it rejects a string with no domain', () => {
  expect(isQAAccountEmail('qa.versidle.com')).toBeFalse();
});
