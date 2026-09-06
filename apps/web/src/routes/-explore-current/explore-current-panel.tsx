import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Button, CheckboxField, Spinner } from '@vers/design-system';
import type { LiveRun, StartStatus } from '@vers/idle-client';
import {
  setEngagedRun,
  useEngagedRun,
  useResyncStatus,
  useWriterGeneration,
} from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import { useSelectedNode } from '@vers/worldmap-client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { WorldMapNodeCodexSlot } from '../../components/world-map-node-codex-slot';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { runIgnoringRejection } from '../../lib/idle/run-ignoring-rejection';
import { sendIdleInitialize } from '../../lib/idle/send-idle-initialize';
import { sendIdleSetFailureAction } from '../../lib/idle/send-idle-set-failure-action';
import { sendIdleStartActivity } from '../../lib/idle/send-idle-start-activity';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';
import { emitProductEvent } from '../../lib/product-events/emit-product-event';
import type { OrpcQueryUtils } from '../../lib/rpc/orpc';
import { ActivityRewardsPanel } from './activity-rewards-panel';
import { ApproachingCapWarning } from './approaching-cap-warning';

interface ExploreCurrentPanelProps {
  readonly orpc: OrpcQueryUtils;
}

interface StartAttemptReport {
  readonly scopeID: string;
  readonly status: StartStatus;
}

export function ExploreCurrentPanel(props: Readonly<ExploreCurrentPanelProps>) {
  const navigate = useNavigate();
  const idleWorkerHandle = useIdleWorkerHandle();
  const selectedNode = useSelectedNode().node;
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const writerGeneration = useWriterGeneration();
  const resyncStatus = useResyncStatus();
  const avatarID = avatarQuery.data?.id;
  const isAutoRetryChecked = idleWorkerHandle.failureAction === ActivityFailureAction.Retry;

  // one start call per selected node, latched by scope id
  const [attemptScopeID, setAttemptScopeID] = useState<string | undefined>(undefined);
  const attemptGeneration = useRef(writerGeneration);

  // latched locally once the call resolves: the store holds only the latest broadcast state, never
  // a start outcome, so this is the panel's only record of its own attempt. Tagged with its scope:
  // a reply can land after the selection moved on and must not read as the new node's outcome
  const [report, setReport] = useState<StartAttemptReport | undefined>(undefined);

  // the exploration commits when the encounter view opens for a node — independent of worker
  // readiness, and a retried failed start on the same node never re-reports it
  const lastExploredNodeID = useRef<string | undefined>(undefined);
  const engagedRun = useEngagedRun();

  useEffect(() => {
    if (selectedNode === null || lastExploredNodeID.current === selectedNode.id) {
      return;
    }

    lastExploredNodeID.current = selectedNode.id;

    emitProductEvent('node_explored', { nodeID: selectedNode.id });
  }, [selectedNode]);

  // a promoted writer never answers a dead writer's call — its abort settles that call, and
  // re-arming the attempt here makes the send effect below re-raise it against the new writer
  useEffect(() => {
    if (attemptGeneration.current === writerGeneration) {
      return;
    }

    attemptGeneration.current = writerGeneration;

    setAttemptScopeID(undefined);
    setReport(undefined);
  }, [writerGeneration]);

  useEffect(() => {
    const client = idleWorkerHandle.client;

    if (client === undefined) {
      return;
    }

    const signal = idleWorkerHandle.writerAbortSignal;

    if (!idleWorkerHandle.initialized) {
      runIgnoringRejection(sendIdleInitialize(client, signal));

      return;
    }

    if (
      avatarID === undefined ||
      selectedNode === null ||
      attemptScopeID === selectedNode.id ||
      resyncStatus?.kind === 'fast-forwarding'
    ) {
      return;
    }

    const scopeID = selectedNode.id;

    setAttemptScopeID(scopeID);
    setReport(undefined);

    void (async () => {
      try {
        const status = await sendIdleStartActivity(
          client,
          { avatarID, scopeID, scopeType: 'world_map_node' },
          signal,
        );

        if (!signal.aborted) {
          setReport({ scopeID, status });
        }
      } catch {
        // an aborted call rejects — the writer-generation re-arm effect already resets the
        // attempt, so there is nothing left to report here
      }
    })();
  }, [
    idleWorkerHandle.client,
    idleWorkerHandle.initialized,
    idleWorkerHandle.writerAbortSignal,
    avatarID,
    selectedNode,
    attemptScopeID,
    resyncStatus,
  ]);

  useEffect(() => {
    if (report?.status.kind !== 'started') {
      return;
    }

    emitProductEvent('activity_started', {
      activityID: report.status.activity.id,
      nodeID: report.status.activity.scopeID,
    });
  }, [report]);

  // a report for a scope the selection has left behind renders nothing — the fresh attempt's own
  // reply overwrites it
  const reportedStatus = report?.scopeID === selectedNode?.id ? report?.status : undefined;

  // readiness follows the live run's scope, never the id the start call answered with: an
  // auto-retry chains a continuation under a fresh id, and the panel stays up across the chain
  const isActivityReady =
    selectedNode !== null &&
    attemptScopeID === selectedNode.id &&
    isRunAtNode(idleWorkerHandle.liveRun, avatarID, selectedNode.id);

  const isEngagedAtNode =
    selectedNode !== null && isRunAtNode(engagedRun, avatarID, selectedNode.id);

  // the engaged run is latched in the idle-client store rather than a component ref, so a remount
  // (browser back, re-drilling the same node) that re-fires the start and finds the same run
  // already live reads it as engaged rather than bouncing the player back.
  useEffect(() => {
    const liveRun = idleWorkerHandle.liveRun;

    if (
      !isActivityReady ||
      liveRun === undefined ||
      reportedStatus === undefined ||
      reportedStatus.kind === 'failed' ||
      liveRun.id === engagedRun?.id
    ) {
      return;
    }

    // an attached run at the node the player already engaged is that run or a continuation of
    // it, so re-engaging would only bounce them off this panel
    if (reportedStatus.kind === 'attached' && isEngagedAtNode) {
      return;
    }

    setEngagedRun(liveRun);
    void navigate({ to: '/activity' });
  }, [
    isActivityReady,
    idleWorkerHandle.liveRun,
    reportedStatus,
    engagedRun,
    isEngagedAtNode,
    navigate,
  ]);

  if (reportedStatus?.kind === 'failed') {
    return (
      <Button
        data-testid="start-activity-retry"
        onClick={() => {
          setAttemptScopeID(undefined);
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
            if (idleWorkerHandle.client === undefined || avatarID === undefined) {
              return;
            }

            const nextFailureAction = isAutoRetryChecked
              ? ActivityFailureAction.Abort
              : ActivityFailureAction.Retry;

            runIgnoringRejection(
              sendIdleSetFailureAction(
                idleWorkerHandle.client,
                avatarID,
                nextFailureAction,
                idleWorkerHandle.writerAbortSignal,
              ),
            );
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

function isRunAtNode(
  run: LiveRun | null | undefined,
  avatarID: string | undefined,
  nodeID: string,
): boolean {
  return (
    run !== undefined &&
    run !== null &&
    run.avatarID === avatarID &&
    run.scopeType === 'world_map_node' &&
    run.scopeID === nodeID
  );
}
