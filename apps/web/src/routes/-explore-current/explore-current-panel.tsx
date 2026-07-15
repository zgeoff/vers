import { CheckboxField, Spinner } from '@vers/design-system';
import { ActivityFailureAction } from '@vers/idle-core';
import { createMockActivityInput, createMockAvatarData } from '@vers/idle-core/test-utils';
import { useSelectedNode } from '@vers/worldmap-client';
import { Suspense, useEffect } from 'react';
import { SimulationUnsupportedNotice } from '../../components/simulation-unsupported-notice';
import { WorldMapNodeCodexSlot } from '../../components/world-map-node-codex-slot';
import { IdleWorldMapEncounterActivity } from '../../lib/idle/idle-world-map-encounter-activity';
import { sendIdleInitialize } from '../../lib/idle/send-idle-initialize';
import { sendIdleSetActivity } from '../../lib/idle/send-idle-set-activity';
import { sendIdleSetFailureAction } from '../../lib/idle/send-idle-set-failure-action';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';
import { useIsSharedWorkerSupported } from '../../lib/platform/use-is-shared-worker-supported';
import type { OrpcQueryUtils } from '../../lib/rpc/orpc';
import { ActivityRewardsPanel } from './activity-rewards-panel';
import { ApproachingCapWarning } from './approaching-cap-warning';

/**
 * Module-scoped so its identity — and its `id` — stays stable across renders.
 */
const PLACEHOLDER_ACTIVITY = createMockActivityInput({
  failureAction: ActivityFailureAction.Abort,
});

const PLACEHOLDER_AVATAR = createMockAvatarData();

interface ExploreCurrentPanelProps {
  readonly orpc: OrpcQueryUtils;
}

/**
 * The world map node detail view: shows a spinner until the idle worker reports the activity it
 * was sent, then renders the encounter, its auto-retry toggle, and its codex slot.
 */
export function ExploreCurrentPanel(props: ExploreCurrentPanelProps) {
  const isSharedWorkerSupported = useIsSharedWorkerSupported();
  const idleWorkerHandle = useIdleWorkerHandle();
  const selectedNode = useSelectedNode().node;
  const isActivityReady = idleWorkerHandle.activity?.id === PLACEHOLDER_ACTIVITY.id;
  const isAutoRetryChecked = idleWorkerHandle.failureAction === ActivityFailureAction.Retry;

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
      <CheckboxField
        checkboxProps={{
          checked: isAutoRetryChecked,
          id: 'auto-retry-on-failure',
          onClick: () => {
            if (idleWorkerHandle.worker === undefined) {
              return;
            }

            const nextFailureAction = isAutoRetryChecked
              ? ActivityFailureAction.Abort
              : ActivityFailureAction.Retry;

            sendIdleSetFailureAction(idleWorkerHandle.worker, nextFailureAction);
          },
        }}
        errors={[]}
        labelProps={{ children: 'Auto-retry on failure', htmlFor: 'auto-retry-on-failure' }}
      />
      <ApproachingCapWarning />
      <IdleWorldMapEncounterActivity />
      <ActivityRewardsPanel activityID={idleWorkerHandle.activity?.id} orpc={props.orpc} />
      <Suspense fallback={<p data-testid="world-map-node-codex-loading">Loading codex…</p>}>
        <WorldMapNodeCodexSlot difficulty={selectedNode?.difficulty ?? 1} />
      </Suspense>
    </>
  );
}
