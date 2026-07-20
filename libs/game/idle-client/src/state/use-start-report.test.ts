import { expect, test } from 'bun:test';
import { renderHook } from '@testing-library/react';
import { useIdleStore } from './use-idle-store';
import { useStartReport } from './use-start-report';

test('it provides the latest start report', () => {
  useIdleStore.setState({
    startReport: { requestID: 'request_1', status: { kind: 'failed' } },
  });

  const hook = renderHook(() => useStartReport());

  expect(hook.result.current).toStrictEqual({
    requestID: 'request_1',
    status: { kind: 'failed' },
  });
});
