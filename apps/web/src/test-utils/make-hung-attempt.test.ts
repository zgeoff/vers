import { expect, test } from 'bun:test';
import { makeHungAttempt } from './make-hung-attempt';

test('it rejects with the abort reason once the signal aborts', async () => {
  const controller = new AbortController();

  const pending = makeHungAttempt()(controller.signal);

  controller.abort(new Error('caller went away'));

  expect(pending).rejects.toThrowWithMessage(Error, 'caller went away');

  await expect(pending).toReject();
});

test('it rejects at once for a signal that has already aborted', async () => {
  const controller = new AbortController();

  controller.abort(new Error('caller already gone'));

  const pending = makeHungAttempt()(controller.signal);

  expect(pending).rejects.toThrowWithMessage(Error, 'caller already gone');

  await expect(pending).toReject();
});

test('it stays pending while the signal is live', async () => {
  const pending = makeHungAttempt()(new AbortController().signal);

  // a 20ms race is the bounded proof that nothing settles the promise on its own
  const winner = await Promise.race([pending, Bun.sleep(20).then(() => 'still pending')]);

  expect(winner).toBe('still pending');
});
