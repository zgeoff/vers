import { expect, test } from 'bun:test';
import { WorkerMessageType } from '../types';
import { createWriterReadyMessage } from './create-writer-ready-message';

test('it builds a writer-ready message', () => {
  expect(createWriterReadyMessage()).toStrictEqual({
    type: WorkerMessageType.WriterReady,
  });
});
