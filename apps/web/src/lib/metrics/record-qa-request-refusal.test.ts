import { expect, test } from 'bun:test';
import { createInMemoryMetrics } from '@vers/test-utils/bun';
import { recordQARequestRefusal } from './record-qa-request-refusal';

test('it counts QA route refusals by reason', async () => {
  const inMemoryMetrics = createInMemoryMetrics();

  recordQARequestRefusal('unauthorized');
  recordQARequestRefusal('unauthorized');
  recordQARequestRefusal('disabled');

  const dataPoints = await inMemoryMetrics.readCounterDataPoints('vers.web.qa_request_refusals');

  const observed = dataPoints.map((dataPoint) => ({
    reason: dataPoint.attributes['reason'],
    value: dataPoint.value,
  }));

  expect(observed).toIncludeSameMembers([
    { reason: 'unauthorized', value: 2 },
    { reason: 'disabled', value: 1 },
  ]);
});
