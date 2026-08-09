import { expect, test } from 'bun:test';
import { ContentDocumentSchema } from '@vers/contract-activity';
import { contentDocumentV1 } from './content-document-v1';
import { contentDocumentV2 } from './content-document-v2';

test('it parses the seeded v1 content document', () => {
  expect(() => ContentDocumentSchema.parse(contentDocumentV1)).not.toThrow();
});

test('it parses the seeded v2 content document', () => {
  expect(() => ContentDocumentSchema.parse(contentDocumentV2)).not.toThrow();
});
