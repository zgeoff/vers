import { expect, test } from 'bun:test';
import { setStartReport } from './set-start-report';
import { useIdleStore } from './use-idle-store';

test('it replaces the stored start report wholesale', () => {
  setStartReport({ requestID: 'request_1', status: { kind: 'failed' } });

  expect(useIdleStore.getState().startReport).toStrictEqual({
    requestID: 'request_1',
    status: { kind: 'failed' },
  });

  setStartReport({
    requestID: 'request_2',
    status: { activityID: 'activity_1', kind: 'attached' },
  });

  expect(useIdleStore.getState().startReport).toStrictEqual({
    requestID: 'request_2',
    status: { activityID: 'activity_1', kind: 'attached' },
  });
});
