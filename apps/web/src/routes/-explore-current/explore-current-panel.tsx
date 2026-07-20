import { useQuery } from '@tanstack/react-query';
import { Button, CheckboxField, Spinner } from '@vers/design-system';
import type { StartStatus } from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import { useSelectedNode } from '@vers/worldmap-client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { SimulationUnsupportedNotice } from '../../components/simulation-unsupported-notice';
import { WorldMapNodeCodexSlot } from '../../components/world-map-node-codex-slot';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { sendIdleInitialize } from '../../lib/idle/send-idle-initialize';
import { sendIdleSetFailureAction } from '../../lib/idle/send-idle-set-failure-action';
import { sendIdleStartActivity } from '../../lib/idle/send-idle-start-activity';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';
import { useIsSharedWorkerSupported } from '../../lib/platform/use-is-shared-worker-supported';
import { emitProductEvent } from '../../lib/product-events/emit-product-event';
import type { OrpcQueryUtils } from '../../lib/rpc/orpc';
import { ActivityRewardsPanel } from './activity-rewards-panel';
import { ApproachingCapWarning } from './approaching-cap-warning';

interface StartAttempt {
  readonly requestID: string;
  readonly scopeID: string;
}

interface ExploreCurrentPanelProps {
  readonly orpc: OrpcQueryUtils;
}

/**
 * The world map node detail view: a spinner until the worker reports the requested start, then
 * the encounter, its auto-retry toggle, and its codex slot. The worker owns the whole start; the
 * panel sends the intent and correlates the report against its own attempt, so another tab's
 * outcome never reads as this one's. A failed start renders a retry action.
 */
export function ExploreCurrentPanel(props: ExploreCurrentPanelProps) {
  const isSharedWorkerSupported = useIsSharedWorkerSupported();
  const idleWorkerHandle = useIdleWorkerHandle();
  const selectedNode = useSelectedNode().node;
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const avatarID = avatarQuery.data?.id;
  const isAutoRetryChecked = idleWorkerHandle.failureAction === ActivityFailureAction.Retry;

  // one start attempt per selected node, correlated by request id
  const [attempt, setAttempt] = useState<StartAttempt | undefined>(undefined);

  // latched locally on correlation: the store holds only the latest broadcast, and another tab's
  // report can overwrite it at any time
  const [report, setReport] = useState<StartStatus | undefined>(undefined);

  // the exploration commits when the encounter view opens for a node — independent of worker
  // readiness, and a retried failed start on the same node never re-reports it
  const lastExploredNodeID = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (selectedNode === null || lastExploredNodeID.current === selectedNode.id) {
      return;
    }

    lastExploredNodeID.current = selectedNode.id;

    emitProductEvent('node_explored', { nodeID: selectedNode.id });
  }, [selectedNode]);

  useEffect(() => {
    if (idleWorkerHandle.worker === undefined) {
      return;
    }

    if (!idleWorkerHandle.initialized) {
      sendIdleInitialize(idleWorkerHandle.worker);

      return;
    }

    if (avatarID === undefined || selectedNode === null || attempt?.scopeID === selectedNode.id) {
      return;
    }

    const requestID = crypto.randomUUID();

    setAttempt({ requestID, scopeID: selectedNode.id });
    setReport(undefined);

    sendIdleStartActivity(idleWorkerHandle.worker, {
      avatarID,
      requestID,
      scopeID: selectedNode.id,
      scopeType: 'world_map_node',
    });
  }, [idleWorkerHandle.worker, idleWorkerHandle.initialized, avatarID, selectedNode, attempt]);

  // only the requesting tab's attempt matches, so the started event fires exactly once
  const startReport = idleWorkerHandle.startReport;

  useEffect(() => {
    if (attempt !== undefined && startReport?.requestID === attempt.requestID) {
      setReport(startReport.status);
    }
  }, [attempt, startReport]);

  useEffect(() => {
    if (report?.kind !== 'started') {
      return;
    }

    emitProductEvent('activity_started', {
      activityID: report.activity.id,
      nodeID: report.activity.scopeID,
    });
  }, [report]);

  const expectedActivityID = findExpectedActivityID(report);

  const isActivityReady =
    expectedActivityID !== undefined &&
    attempt?.scopeID === selectedNode?.id &&
    idleWorkerHandle.activity?.id === expectedActivityID;

  if (!isSharedWorkerSupported) {
    return <SimulationUnsupportedNotice />;
  }

  if (report?.kind === 'failed') {
    return (
      <Button
        data-testid="start-activity-retry"
        onClick={() => {
          setAttempt(undefined);
          setReport(undefined);
        }}
      >
        Couldn’t start this activity — retry
      </Button>
    );
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
            if (idleWorkerHandle.worker === undefined || avatarID === undefined) {
              return;
            }

            const nextFailureAction = isAutoRetryChecked
              ? ActivityFailureAction.Abort
              : ActivityFailureAction.Retry;

            sendIdleSetFailureAction(idleWorkerHandle.worker, avatarID, nextFailureAction);
          },
        }}
        errors={[]}
        labelProps={{ children: 'Auto-retry on failure', htmlFor: 'auto-retry-on-failure' }}
      />
      <ApproachingCapWarning />
      <ActivityRewardsPanel activityID={idleWorkerHandle.activity?.id} orpc={props.orpc} />
      <Suspense fallback={<p data-testid="world-map-node-codex-loading">Loading codex…</p>}>
        <WorldMapNodeCodexSlot difficulty={selectedNode?.difficulty ?? 1} />
      </Suspense>
    </>
  );
}

function findExpectedActivityID(report: StartStatus | undefined): string | undefined {
  if (report === undefined || report.kind === 'failed') {
    return undefined;
  }

  if (report.kind === 'started') {
    return report.activity.id;
  }

  return report.activityID;
}
