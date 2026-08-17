import type { WorkerFaultSite } from './report-worker-fault';
import { reportWorkerFault } from './report-worker-fault';

/**
 * The single owner of lifecycle serialization for one worker runtime.
 *
 * `runTurn` queues any lifecycle flow behind the mailbox's tail: starts, resyncs, and
 * continuations run strictly one at a time, in arrival order. Only a public entrypoint queues
 * through it — an inner sub-flow calls its own body directly, since a turn awaiting a turn queued
 * behind itself deadlocks. A turn never rejects; an escaping error reports as a fault under
 * `site`, so the tail always advances. Stops never queue — a queued flow observes one through the
 * stop signal it captured at entry.
 *
 * `runResyncTurn` layers resync coalescing on top, private to the mailbox: a non-claiming call
 * arriving while one is queued or running is dropped, since the running one already resyncs
 * against the freshest server state a retry could see; a claiming call is held one deep instead —
 * latest arrival winning — and re-run once the in-flight one settles. The coalescing state lives
 * only here, so a resync an inner sub-flow runs inline can neither open nor close the drop window
 * for one still waiting on its queue slot.
 */
export interface LifecycleMailbox {
  readonly runTurn: (site: WorkerFaultSite, fn: () => Promise<void>) => Promise<void>;

  /**
   * `prepare` runs synchronously at each enqueue decision — the initial accept, and again if a
   * held claim is re-run after the in-flight turn settles — and returns the turn body to queue;
   * calling it at enqueue time, rather than once at accept, lets each run capture its own
   * point-in-time state (cancellation signals) instead of reusing the first run's. A claiming
   * arrival during the drop window resolves immediately without awaiting its held follow-up run;
   * the original caller's returned promise settles only after both its own turn and any held
   * claim's follow-up have run.
   */
  readonly runResyncTurn: (
    avatarID: string,
    claim: boolean,
    prepare: (avatarID: string, claim: boolean) => () => Promise<void>,
  ) => Promise<void>;
}

interface ResyncTicket {
  pendingClaimAvatarID: string | null;
}

/**
 * Builds one mailbox instance. A runtime constructs exactly one and shares it through
 * `WorkerContext.getMailbox` for its whole lifetime.
 */
export function createLifecycleMailbox(): LifecycleMailbox {
  let tail: Readonly<Promise<void>> = Promise.resolve();
  let resyncTicket: ResyncTicket | null = null;

  const runTurn = async (site: WorkerFaultSite, fn: () => Promise<void>): Promise<void> => {
    const previous = tail;

    const turn = (async () => {
      await previous;

      try {
        await fn();
      } catch (error) {
        reportWorkerFault(site, error);
      }
    })();

    tail = turn;

    await turn;
  };

  const runResyncTurn = async (
    avatarID: string,
    claim: boolean,
    prepare: (avatarID: string, claim: boolean) => () => Promise<void>,
  ): Promise<void> => {
    if (resyncTicket !== null) {
      if (claim) {
        resyncTicket.pendingClaimAvatarID = avatarID;
      }

      return;
    }

    const ticket: ResyncTicket = { pendingClaimAvatarID: null };

    resyncTicket = ticket;

    const body = prepare(avatarID, claim);

    await runTurn('resync', body);

    resyncTicket = null;

    if (ticket.pendingClaimAvatarID !== null) {
      await runResyncTurn(ticket.pendingClaimAvatarID, true, prepare);
    }
  };

  return { runResyncTurn, runTurn };
}
