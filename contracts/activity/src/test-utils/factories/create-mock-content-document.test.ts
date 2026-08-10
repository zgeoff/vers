import { expect, test } from 'bun:test';
import { ContentDocumentSchema } from '../../content-document-schema';
import { createMockContentDocument } from './create-mock-content-document';

test('it builds a contract-valid document by default', () => {
  const document = createMockContentDocument();

  expect(ContentDocumentSchema.parse(document)).toStrictEqual(document);
});

test('it defaults to a numeric-string contentVersion carried through encounter and loot', () => {
  const document = createMockContentDocument();

  expect(document.contentVersion).toMatch(/^\d{6}$/);
  expect(document.encounter.contentVersion).toBe(document.contentVersion);
  expect(document.loot.contentVersion).toBe(document.contentVersion);
});

test('it threads an overridden contentVersion into encounter and loot', () => {
  const document = createMockContentDocument({ contentVersion: 'fixed-version' });

  expect(document.contentVersion).toBe('fixed-version');
  expect(document.encounter.contentVersion).toBe('fixed-version');
  expect(document.loot.contentVersion).toBe('fixed-version');
});
