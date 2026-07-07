import { useSelectedNode } from '@vers/aether-client';
import { Spinner } from '@vers/design-system';
import { createMockActivityData, createMockAvatarData } from '@vers/idle-core';
import { Suspense, useEffect } from 'react';
import { AetherNodeCodexSlot } from '../../components/aether-node-codex-slot';
import { IdleAetherNode } from '../../lib/idle/idle-aether-node';
import { sendIdleInitialize } from '../../lib/idle/send-idle-initialize';
import { sendIdleSetActivity } from '../../lib/idle/send-idle-set-activity';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';

/**
 * A placeholder activity every visit sends the worker, until a real activity-selection flow picks
 * one from the map. Module-scoped so its identity — and so its `id` — stays stable across renders.
 */
const PLACEHOLDER_ACTIVITY = createMockActivityData();
const PLACEHOLDER_AVATAR = createMockAvatarData();

/**
 * The aether node detail view: sends the SharedWorker `Initialize` once, then `SetActivity` for
 * the placeholder activity, showing a spinner until the worker's own state catches up to it.
 * Client lane end to end per the two-lane rule; the codex fragment alongside the node visual is
 * the one server-fragment slot in this game chrome.
 */
export function AetherCurrentPanel() {
  const idleWorkerHandle = useIdleWorkerHandle();
  const selectedNode = useSelectedNode().node;
  const isActivityReady = idleWorkerHandle.activity?.id === PLACEHOLDER_ACTIVITY.id;

  useEffect(() => {
    if (idleWorkerHandle.worker === undefined) {
      return;
    }

    if (!idleWorkerHandle.initialized) {
      sendIdleInitialize(idleWorkerHandle.worker);

      return;
    }

    if (!isActivityReady) {
      sendIdleSetActivity(idleWorkerHandle.worker, PLACEHOLDER_ACTIVITY, PLACEHOLDER_AVATAR);
    }
  }, [idleWorkerHandle.worker, idleWorkerHandle.initialized, isActivityReady]);

  if (!isActivityReady) {
    return <Spinner />;
  }

  return (
    <>
      <IdleAetherNode />
      <Suspense fallback={<p data-testid="aether-node-codex-loading">Loading codex…</p>}>
        <AetherNodeCodexSlot difficulty={selectedNode?.difficulty ?? 1} />
      </Suspense>
    </>
  );
}
