import { expect, test } from 'bun:test';
import { CheckpointBatchEntrySchema } from '@vers/contract-activity';
import { createMockCheckpointBatchEntry } from './create-mock-checkpoint-batch-entry';

test('it builds a schema-valid batch entry', () => {
  const entry = createMockCheckpointBatchEntry();

  expect(CheckpointBatchEntrySchema.parse(entry)).toStrictEqual(entry);
});

test('it applies overrides', () => {
  const entry = createMockCheckpointBatchEntry({ version: 7 });

  expect(entry.version).toBe(7);
});
