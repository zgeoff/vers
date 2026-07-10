import { useSelectedNode } from '@vers/aether-client';
import { Spinner } from '@vers/design-system';
import { createMockActivityData, createMockAvatarData } from '@vers/idle-core';
import { Suspense, useEffect } from 'react';
import { AetherNodeCodexSlot } from '../../components/aether-node-codex-slot';
import { SimulationUnsupportedNotice } from '../../components/simulation-unsupported-notice';
import { IdleAetherNode } from '../../lib/idle/idle-aether-node';
import { sendIdleInitialize } from '../../lib/idle/send-idle-initialize';
import { sendIdleSetActivity } from '../../lib/idle/send-idle-set-activity';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';
import { useIsSharedWorkerSupported } from '../../lib/platform/use-is-shared-worker-supported';

/**
 * Module-scoped so its identity — and its `id` — stays stable across renders.
 */
const PLACEHOLDER_ACTIVITY = createMockActivityData();
const PLACEHOLDER_AVATAR = createMockAvatarData();

/**
 * The aether node detail view: shows a spinner until the idle worker reports the activity it was
 * sent, then renders the node and its codex slot.
 */
export function ExploreCurrentPanel() {
  const isSharedWorkerSupported = useIsSharedWorkerSupported();
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

  if (!isSharedWorkerSupported) {
    return <SimulationUnsupportedNotice />;
  }

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
