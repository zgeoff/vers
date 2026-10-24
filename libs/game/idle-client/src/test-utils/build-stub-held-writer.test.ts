import { expect, mock, test } from 'bun:test';
import { buildStubHeldWriter } from './build-stub-held-writer';

test('it holds a write it has reached until the release', async () => {
  const write = mock(async (_value: string) => {});
  const writer = buildStubHeldWriter(write);
  const written = writer.write('row_held');

  await writer.reached;

  expect(write).not.toHaveBeenCalled();

  writer.release();

  await written;

  expect(write).toHaveBeenCalledExactlyOnceWith('row_held');
});

test('it writes at once when the release came before the call', async () => {
  const write = mock(async (_value: string) => {});
  const writer = buildStubHeldWriter(write);

  writer.release();

  await writer.write('row_released');

  expect(write).toHaveBeenCalledExactlyOnceWith('row_released');
});
