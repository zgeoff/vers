import { expect, test } from 'bun:test';
import { createStubWorkerContext } from '../test-utils/create-stub-worker-context';
import { hasStopIntervened } from './has-stop-intervened';

test('it reports no stop while the epoch holds', () => {
  const context = createStubWorkerContext();

  expect(hasStopIntervened(context, context.getStopEpoch())).toBeFalse();
});

test('it reports a stop once the epoch advances past the captured value', () => {
  const context = createStubWorkerContext();
  const entryEpoch = context.getStopEpoch();

  context.advanceStopEpoch();

  expect(hasStopIntervened(context, entryEpoch)).toBeTrue();
});
