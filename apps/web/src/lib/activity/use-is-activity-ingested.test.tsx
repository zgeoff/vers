import { expect, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import { setLastIngestedActivityID, writeActivityStart } from '@vers/idle-client';
import { renderHook } from '../../test-utils/render-hook';
import { useIsActivityIngested } from './use-is-activity-ingested';

test('it reports an activity the server already holds', async () => {
  const hook = renderHook(() => useIsActivityIngested('act_ingested_server_held'));

  await waitFor(() => {
    expect(hook.result.current).toBe(true);
  });
});

test('it holds back an activity whose client-minted start is still pending', async () => {
  const row = createMockActivityData({ id: 'act_ingested_still_pending' });

  await writeActivityStart(row);

  const hook = renderHook(() => useIsActivityIngested(row.id));

  // the answer starts false, so only a bounded wait for the opposite proves the pending-start read
  // landed and left it false; 100ms outlasts a local store read by a wide margin
  await expect(
    waitFor(
      () => {
        expect(hook.result.current).toBe(true);
      },
      { timeout: 100 },
    ),
  ).toReject();
});

test('it reads the pending start store again once the worker reports an ingest', async () => {
  const row = createMockActivityData({ id: 'act_ingested_rereads' });
  const hook = renderHook(() => useIsActivityIngested(row.id));

  await waitFor(() => {
    expect(hook.result.current).toBe(true);
  });

  await writeActivityStart(row);

  setLastIngestedActivityID('act_ingested_elsewhere');

  await waitFor(() => {
    expect(hook.result.current).toBe(false);
  });
});

test('it holds back an activity switched to while the incoming read is still in flight', async () => {
  const pending = createMockActivityData({ id: 'act_ingested_switch_incoming' });

  await writeActivityStart(pending);

  let currentActivityID = 'act_ingested_switch_outgoing';
  const hook = renderHook(() => useIsActivityIngested(currentActivityID));

  await waitFor(() => {
    expect(hook.result.current).toBe(true);
  });

  currentActivityID = pending.id;

  hook.rerender();

  expect(hook.result.current).toBe(false);
});

test('it reports false while no activity is in flight', () => {
  const hook = renderHook(() => useIsActivityIngested(undefined));

  expect(hook.result.current).toBe(false);
});
