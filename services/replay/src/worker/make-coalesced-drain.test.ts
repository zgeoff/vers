import { expect, mock, test } from 'bun:test';
import { waitFor } from '@vers/test-utils';
import { makeCoalescedDrain } from './make-coalesced-drain';

test('it runs the drain once for a single request', async () => {
  const runDrain = mock((_input: string) => Promise.resolve(3));
  const requestDrain = makeCoalescedDrain(runDrain);

  const claimed = await requestDrain('first');

  expect(claimed).toBe(3);
  expect(runDrain).toHaveBeenCalledOnce();
});

test('it runs the drain once more for a request that joins a drain in flight', async () => {
  const gate = Promise.withResolvers<number>();
  const runDrain = mock((_input: string) => gate.promise);
  const requestDrain = makeCoalescedDrain(runDrain);
  const first = requestDrain('first');

  await waitFor(() => {
    expect(runDrain).toHaveBeenCalledOnce();
  });

  const joined = requestDrain('joined');

  gate.resolve(2);

  const claimed = await Promise.all([first, joined]);

  expect(claimed).toStrictEqual([4, 4]);
  expect(runDrain.mock.calls).toStrictEqual([['first'], ['joined']]);
});

test('it starts a fresh drain for a request after the last one resolved', async () => {
  const runDrain = mock((_input: string) => Promise.resolve(1));
  const requestDrain = makeCoalescedDrain(runDrain);

  await requestDrain('first');

  const claimed = await requestDrain('second');

  expect(claimed).toBe(1);
});
