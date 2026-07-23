import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Button, CheckboxField, Spinner } from '@vers/design-system';
import type { StartStatus } from '@vers/idle-client';
import {
  setEngagedActivityID,
  useEngagedActivityID,
  useResyncStatus,
  useWriterGeneration,
} from '@vers/idle-client';
import { ActivityFailureAction } from '@vers/idle-core';
import { useSelectedNode } from '@vers/worldmap-client';
import { Suspense, useEffect, useRef, useState } from 'react';
import invariant from 'tiny-invariant';
import { AvatarSwitchedNotice } from '../../components/avatar-switched-notice';
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

/**
 * The world map node detail view: a spinner until the worker answers the requested start, then
 * the encounter, its auto-retry toggle, and its codex slot. The worker owns the whole start; the
 * panel awaits the call directly and renders its own outcome, so another tab's run never reads as
 * this one's. A failed start renders a retry action. Once the start goes live the panel navigates
 * to the engagement screen, once per activity — latched in `@vers/idle-client`'s store rather than
 * a component ref, so a remount (the browser back button, re-drilling the same node) that re-fires
 * the start call and finds the same activity already live reads it as already engaged rather than
 * bouncing the player back. A start rejected because the account's active avatar changed renders a
 * distinct notice naming the current one, with a reload action rather than the generic retry — the
 * route's own data still names the stale avatar, and only a reload re-runs every gate against the
 * new one. While an offline catch-up is still fast-forwarding, the panel withholds its start call
 * — the lockout overlay above it covers the UI, but this keeps a mounted panel from auto-sending a
 * start of its own underneath it.
 */
export function ExploreCurrentPanel(props: ExploreCurrentPanelProps) {
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

  // latched locally once the call resolves: the store holds only the latest broadcast state,
  // never a start outcome, so this is the panel's only record of its own attempt — tagged with
  // its scope, since a reply can land after the selection moved on and must not read as the new
  // node's outcome
  const [report, setReport] = useState<StartAttemptReport | undefined>(undefined);

  // the exploration commits when the encounter view opens for a node — independent of worker
  // readiness, and a retried failed start on the same node never re-reports it
  const lastExploredNodeID = useRef<string | undefined>(undefined);
  const engagedActivityID = useEngagedActivityID();

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
  const expectedActivityID = findExpectedActivityID(reportedStatus);

  const isActivityReady =
    expectedActivityID !== undefined &&
    attemptScopeID === selectedNode?.id &&
    idleWorkerHandle.activity?.id === expectedActivityID;

  useEffect(() => {
    if (!isActivityReady || expectedActivityID === engagedActivityID) {
      return;
    }

    invariant(expectedActivityID !== undefined, 'an activity ready state carries its activity id');
    setEngagedActivityID(expectedActivityID);
    void navigate({ to: '/activity' });
  }, [isActivityReady, expectedActivityID, engagedActivityID, navigate]);

  if (reportedStatus?.kind === 'failed' && reportedStatus.rejection !== undefined) {
    return (
      <AvatarSwitchedNotice
        activeAvatarName={reportedStatus.rejection.activeAvatarName}
        testID="start-activity-avatar-not-active"
      />
    );
  }

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

function findExpectedActivityID(report: StartStatus | undefined): string | undefined {
  if (report === undefined || report.kind === 'failed') {
    return undefined;
  }

  if (report.kind === 'started') {
    return report.activity.id;
  }

  return report.activityID;
}
