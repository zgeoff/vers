import { expect, test } from 'bun:test';
import { waitFor } from '@testing-library/react';
import { createMockActivityData } from '@vers/contract-activity/test-utils';
import {
  setLastCompletedActivityID,
  writeActivityStart,
  writeQueuedCheckpoint,
} from '@vers/idle-client';
import { ActivityCheckpointType } from '@vers/idle-core';
import { createMockCheckpointBatchEntry } from '../../test-utils/create-mock-checkpoint-batch-entry';
import { renderHook } from '../../test-utils/render-hook';
import { useOfflineClearedNodeIDs } from './use-offline-cleared-node-ids';

test('it includes a node whose pending root queued a completed terminal', async () => {
  const avatarID = 'avatar-offline-cleared-completed';
  const row = createMockActivityData({ avatarID, scopeID: '2_0' });

  await writeActivityStart(row);

  await writeQueuedCheckpoint(
    row.id,
    createMockCheckpointBatchEntry({ payload: { type: ActivityCheckpointType.Completed } }),
  );

  const hook = renderHook(() => useOfflineClearedNodeIDs(avatarID));

  await waitFor(() => {
    expect(hook.result.current).toStrictEqual(new Set(['2_0']));
  });
});

test('it excludes a node whose pending root queued a failed terminal', async () => {
  const avatarID = 'avatar-offline-cleared-failed';
  const row = createMockActivityData({ avatarID, scopeID: '3_0' });

  await writeActivityStart(row);

  await writeQueuedCheckpoint(
    row.id,
    createMockCheckpointBatchEntry({ payload: { type: ActivityCheckpointType.Failed } }),
  );

  const hook = renderHook(() => useOfflineClearedNodeIDs(avatarID));

  await waitFor(() => {
    expect(hook.result.current).toStrictEqual(new Set());
  });
});

test('it re-derives once a fresh offline clear reports through lastCompletedActivityID', async () => {
  const avatarID = 'avatar-offline-cleared-rederive';
  const hook = renderHook(() => useOfflineClearedNodeIDs(avatarID));

  await waitFor(() => {
    expect(hook.result.current).toStrictEqual(new Set());
  });

  const row = createMockActivityData({ avatarID, scopeID: '4_0' });

  await writeActivityStart(row);

  await writeQueuedCheckpoint(
    row.id,
    createMockCheckpointBatchEntry({ payload: { type: ActivityCheckpointType.Completed } }),
  );

  setLastCompletedActivityID(row.id);

  await waitFor(() => {
    expect(hook.result.current).toStrictEqual(new Set(['4_0']));
  });
});

test('it reads empty across an avatar switch rather than inheriting the outgoing set', async () => {
  const outgoing = 'avatar-switch-outgoing';
  const row = createMockActivityData({ avatarID: outgoing, scopeID: '5_0' });

  await writeActivityStart(row);

  await writeQueuedCheckpoint(
    row.id,
    createMockCheckpointBatchEntry({ payload: { type: ActivityCheckpointType.Completed } }),
  );

  let currentAvatarID = outgoing;
  const hook = renderHook(() => useOfflineClearedNodeIDs(currentAvatarID));

  await waitFor(() => {
    expect(hook.result.current).toStrictEqual(new Set(['5_0']));
  });

  currentAvatarID = 'avatar-switch-incoming';

  hook.rerender();

  expect(hook.result.current).toStrictEqual(new Set());
});

test('it returns the empty set while no avatar id is given', () => {
  const hook = renderHook(() => useOfflineClearedNodeIDs(undefined));

  expect(hook.result.current).toStrictEqual(new Set());
});
