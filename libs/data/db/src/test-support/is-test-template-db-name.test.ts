import { expect, test } from 'bun:test';
import { isTestTemplateDBName } from './is-test-template-db-name';

test('it matches a branch-scoped test-template database name', () => {
  expect(isTestTemplateDBName('test_template_main')).toBeTrue();
});

test('it does not match the container bootstrap database', () => {
  expect(isTestTemplateDBName('test_template')).toBeFalse();
});

test('it does not match an unrelated database', () => {
  expect(isTestTemplateDBName('test_a1b2c3')).toBeFalse();
});
