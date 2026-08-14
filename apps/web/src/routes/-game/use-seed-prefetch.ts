import { useQuery } from '@tanstack/react-query';
import { MAX_REVEAL_BATCH_NODES } from '@vers/contract-activity';
import type { WorkerClient } from '@vers/idle-client';
import { useEffect, useRef } from 'react';
import { buildActiveAvatarQueryOptions } from '../../lib/avatar/build-active-avatar-query-options';
import { runIgnoringRejection } from '../../lib/idle/run-ignoring-rejection';
import { sendIdleCacheNodeSeeds } from '../../lib/idle/send-idle-cache-node-seeds';
import { useIdleWorkerHandle } from '../../lib/idle/use-idle-worker-handle';
import { orpc } from '../../lib/rpc/orpc';

/**
 * The node ids this mount has already fetched a genesis seed for, scoped to the avatar they were
 * fetched for — an avatar switch must not skip revealing a node id the outgoing avatar happened to
 * share, since the two avatars' chains for that coordinate are distinct.
 */
interface SessionRevealed {
  readonly avatarID: string | undefined;
  readonly nodeIDs: Set<string>;
}

/**
 * Keeps the worker's on-device genesis-seed cache filled for the active avatar's fog-revealed
 * frontier: every node id `useAvatarRegionGraph` projects as revealed gets its genesis seed
 * fetched through `revealNodes` and relayed to the worker, so a node the player can already see on
 * the map has its seed durably cached before an offline-open start needs it. Only the delta beyond
 * this mount's own revealed set is fetched — re-revealing a node after a reload costs one more
 * idempotent round trip, never a duplicate seed. A reveal or cache failure is swallowed: this hook
 * never blocks or breaks rendering over a prefetch that can simply retry once the revealed set next
 * changes.
 */
export function useSeedPrefetch(revealedNodeIDs: ReadonlySet<string>): void {
  const avatarQuery = useQuery(buildActiveAvatarQueryOptions());
  const avatarID = avatarQuery.data?.id;
  const client = useIdleWorkerHandle().client;
  const sessionRef = useRef<SessionRevealed>({ avatarID: undefined, nodeIDs: new Set() });

  useEffect(() => {
    const controller = new AbortController();

    if (avatarID !== undefined && client !== undefined) {
      if (sessionRef.current.avatarID !== avatarID) {
        sessionRef.current = { avatarID, nodeIDs: new Set() };
      }

      const session = sessionRef.current;
      const delta = [...revealedNodeIDs].filter((nodeID) => !session.nodeIDs.has(nodeID));

      if (delta.length > 0) {
        runIgnoringRejection(
          runSeedReveal(client, avatarID, delta, session.nodeIDs, controller.signal),
        );
      }
    }

    return () => {
      controller.abort();
    };
  }, [avatarID, client, revealedNodeIDs]);
}

/**
 * Reveals a node-id delta in batches capped at the server's per-request limit, relaying each
 * batch's minted seeds to the worker scoped to the active avatar. The whole delta is marked in the
 * session set before the first reveal awaits, so a frontier change mid-flight never re-issues a
 * request for an id already being fetched. A batch that fails — a genuine fault or an abort as the
 * effect re-runs — removes that batch's ids and every still-unfetched id after it from the session
 * set, so nothing stays marked as done that this device never cached and the next frontier change
 * retries them.
 */
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
      const seeds = await orpc.activity.revealNodes.call({ avatarID, nodeIDs: batch }, { signal });

      await sendIdleCacheNodeSeeds(client, { avatarID, seeds }, signal);
    } catch {
      for (const nodeID of delta.slice(start)) {
        sessionNodeIDs.delete(nodeID);
      }

      return;
    }
  }
}
