import { useQuery } from '@tanstack/react-query';
import { MAX_REVEAL_BATCH_NODES } from '@vers/contract-activity';
import type { WorkerClient } from '@vers/idle-client';
import { useEffect, useRef } from 'react';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { runIgnoringRejection } from '../../lib/idle/run-ignoring-rejection';
import { sendIdleCacheNodeSeeds } from '../../lib/idle/send-idle-cache-node-seeds';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';
import { orpc } from '../../lib/rpc/orpc';

interface SessionRevealed {
  readonly avatarID: string | undefined;
  readonly nodeIDs: Set<string>;
}

export function useSeedPrefetch(revealedNodeIDs: ReadonlySet<string>): void {
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const avatarID = avatarQuery.data?.id;
  const client = useIdleWorkerHandle().client;
  const sessionRef = useRef<SessionRevealed>({ avatarID: undefined, nodeIDs: new Set() });
  const controllerRef = useRef<AbortController>(new AbortController());

  // the abort lifecycle is keyed on the avatar and worker client alone: a growing frontier must let
  // a running batch finish caching its seeds. Declared before the reveal effect so its fresh
  // controller is in place when the reveal fires.
  useEffect(() => {
    const controller = new AbortController();

    controllerRef.current = controller;

    return () => {
      controller.abort();
    };
  }, [avatarID, client]);

  useEffect(() => {
    if (avatarID === undefined || client === undefined) {
      return;
    }

    if (sessionRef.current.avatarID !== avatarID) {
      sessionRef.current = { avatarID, nodeIDs: new Set() };
    }

    const session = sessionRef.current;
    const delta = [...revealedNodeIDs].filter((nodeID) => !session.nodeIDs.has(nodeID));

    if (delta.length > 0) {
      runIgnoringRejection(
        runSeedReveal(client, avatarID, delta, session.nodeIDs, controllerRef.current.signal),
      );
    }
  }, [avatarID, client, revealedNodeIDs]);
}

async function runSeedReveal(
  client: WorkerClient,
  avatarID: string,
  delta: ReadonlyArray<string>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- mutated in place: the delta is marked up front and a failed batch's still-unfetched tail is unmarked
  sessionNodeIDs: Set<string>,
  signal: AbortSignal,
): Promise<void> {
  for (const nodeID of delta) {
    sessionNodeIDs.add(nodeID);
  }

  for (let start = 0; start < delta.length; start += MAX_REVEAL_BATCH_NODES) {
    const batch = delta.slice(start, start + MAX_REVEAL_BATCH_NODES);

    try {
      const revealed = await orpc.activity.revealNodes.call(
        { avatarID, nodeIDs: batch },
        { signal },
      );

      const stamps = {
        keyVersion: revealed.keyVersion,
        secretRef: revealed.secretRef,
        secretVersion: revealed.secretVersion,
      };

      await sendIdleCacheNodeSeeds(client, { avatarID, seeds: revealed.nodes, stamps }, signal);
    } catch {
      for (const nodeID of delta.slice(start)) {
        sessionNodeIDs.delete(nodeID);
      }

      return;
    }
  }
}
