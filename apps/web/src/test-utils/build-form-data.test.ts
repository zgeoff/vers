import { expect, test } from 'bun:test';
import { buildFormData } from './build-form-data';

test('it sets every field on the form data', () => {
  const formData = buildFormData({ email: 'x@vers.test', password: 'password123' });

  expect(formData.get('email')).toBe('x@vers.test');
  expect(formData.get('password')).toBe('password123');
});

test('it builds an empty form data from an empty map', () => {
  expect([...buildFormData({}).keys()]).toBeArrayOfSize(0);
});
