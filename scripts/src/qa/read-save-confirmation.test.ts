import { expect, test } from 'bun:test';
import { Readable } from 'node:stream';
import { readSaveConfirmation } from './read-save-confirmation';

test('it confirms the save on a saved line', async () => {
  const input = Readable.from(['sa', 'ved\n']);

  const isSaved = await readSaveConfirmation(input);

  expect(isSaved).toBe(true);
});

test('it refuses the save when the input ends before a line', async () => {
  const input = Readable.from(['saved']);

  const isSaved = await readSaveConfirmation(input);

  expect(isSaved).toBe(false);
});

test('it refuses the save on any other line', async () => {
  const input = Readable.from(['abort\n']);

  const isSaved = await readSaveConfirmation(input);

  expect(isSaved).toBe(false);
});
