import { expect, onTestFinished, test } from 'bun:test';
import { setCheckpointFlushStall } from './set-checkpoint-flush-stall';
import { useIdleStore } from './use-idle-store';

test('it records the flush stall report', () => {
  onTestFinished(() => {
    useIdleStore.setState({ checkpointFlushStall: null });
  });

  setCheckpointFlushStall({ activityID: 'activity_1', reason: 'network down', traceID: 'trace_1' });

  expect(useIdleStore.getState().checkpointFlushStall).toStrictEqual({
    activityID: 'activity_1',
    reason: 'network down',
    traceID: 'trace_1',
  });
});

test('it clears a consumed flush stall report', () => {
  setCheckpointFlushStall({ activityID: 'activity_1', reason: 'network down', traceID: 'trace_1' });
  setCheckpointFlushStall(null);
  expect(useIdleStore.getState().checkpointFlushStall).toBeNull();
});

test('it leaves the reward-slot ledger untouched when a flush stalls', () => {
  onTestFinished(() => {
    useIdleStore.setState({ checkpointFlushStall: null, rewardSlotLedger: [] });
  });

  useIdleStore.setState({
    checkpointFlushStall: null,
    rewardSlotLedger: [{ count: 2, version: 1 }],
  });

  setCheckpointFlushStall({ activityID: 'activity_1', reason: 'network down', traceID: 'trace_1' });
  expect(useIdleStore.getState().rewardSlotLedger).toStrictEqual([{ count: 2, version: 1 }]);
});
