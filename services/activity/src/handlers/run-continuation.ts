import type { DB } from '@vers/db';
import { toJSON } from '@vers/db';
import { isTerminalCheckpointType } from '@vers/idle-core';
import { sql } from 'kysely';
import type { Kysely } from 'kysely';
import invariant from 'tiny-invariant';
import { z } from 'zod';
import { findCheckpointBatchInvalidReason } from '../find-checkpoint-batch-invalid-reason';
import { recordTerminalTransition } from '../metrics/record-terminal-transition';
import { pickCheckpointBatchRaceOutcome } from '../pick-checkpoint-batch-race-outcome';
import { pickSimTimeCreditRate } from '../pick-sim-time-credit-rate';
import { ContinuationBailError } from './continuation-bail-error';
import { mintContinuation } from './mint-continuation';
import type {
  AdvanceActivityDeps,
  MintedContinuation,
  PinnedActivityContext,
  RunContinuationInput,
} from './types';
import { updateAppendedAnchorFromTail } from './update-appended-anchor-from-tail';

export async function runContinuation(
  deps: AdvanceActivityDeps,
  pinned: Readonly<PinnedActivityContext>,
  input: Readonly<RunContinuationInput>,
): Promise<MintedContinuation> {
  // The target read and its structural validation run outside any transaction, matching
  // trackActivityProgress's own shape, so a rejection found here needs no rollback.
  const target = await deps.db
    .selectFrom('activities')
    .innerJoin('avatars', 'avatars.id', 'activities.avatarId')
    .select([
      'activities.appendedHead',
      'activities.appendedTimeMs',
      'activities.lastHash',
      'activities.startChainIndex',
      'activities.status',
      'activities.writerSessionId',
      'avatars.isQa',
      'avatars.simBudgetMs',
      'avatars.simMeteredAt',
    ])

    // Cast to the meter columns' timestamp type so the driver parses both sides of the elapsed
    // subtraction identically regardless of session timezone.
    .select(sql`now()::timestamp`.as('meterReadAt'))
    .where('activities.id', '=', input.targetActivityID)
    .executeTakeFirst();

  invariant(target !== undefined, 'a continuation target row must exist once minted');

  const appendedTimeMs = Number(target.appendedTimeMs);

  if (target.status !== 'active') {
    const raceOutcome = pickCheckpointBatchRaceOutcome(
      input.actingSessionID,
      target,
      input.continuation.checkpoints,
    );

    if (raceOutcome.kind !== 'resubmit-settled') {
      invariant(
        raceOutcome.kind === 'terminal',
        'a non-active head resolves only settled or terminal',
      );

      throw new ContinuationBailError({
        activityID: input.targetActivityID,
        appendedHead: raceOutcome.appendedHead,
        kind: 'terminal',
        status: raceOutcome.status,
      });
    }

    // The tail already landed in an earlier, partially committed request — nothing left to
    // append. Only the mint may still be outstanding, so fall through to it, in its own
    // transaction — no append precedes it here to roll back alongside a rejected mint.
    return deps.db.transaction().execute((trx) => mintContinuation(trx, input, pinned));
  }

  if (target.writerSessionId !== null && target.writerSessionId !== input.actingSessionID) {
    throw new ContinuationBailError({
      activityID: input.targetActivityID,
      appendedHead: target.appendedHead,
      kind: 'session-evicted',
    });
  }

  const reason = findCheckpointBatchInvalidReason(
    { checkpoints: input.continuation.checkpoints, expectedHead: input.targetExpectedHead },
    { ...target, appendedTimeMs },
  );

  if (reason !== undefined) {
    throw new ContinuationBailError({
      activityID: input.targetActivityID,
      appendedHead: target.appendedHead,
      avatarID: pinned.avatarId,
      kind: 'checkpoint-invalid',
      reason,
    });
  }

  const lastCheckpoint = input.continuation.checkpoints.at(-1);

  invariant(lastCheckpoint !== undefined, 'a continuation always carries at least one checkpoint');

  if (!isTerminalCheckpointType(lastCheckpoint.payload.type)) {
    throw new ContinuationBailError({
      activityID: input.targetActivityID,
      appendedHead: target.appendedHead,
      avatarID: pinned.avatarId,
      kind: 'checkpoint-invalid',
      reason: 'continuation-not-terminal',
    });
  }

  const newTimeMs = lastCheckpoint.payload.time;
  const timeDelta = newTimeMs - appendedTimeMs;
  const creditRate = pickSimTimeCreditRate(target);

  const accruedMs =
    Number(target.simBudgetMs) +
    (z.date().parse(target.meterReadAt).getTime() - target.simMeteredAt.getTime()) * creditRate;

  const availableMs = Math.min(deps.simTimeCapMs, accruedMs);

  if (timeDelta > availableMs) {
    const capOutcome = await deps.db.transaction().execute(async (trx) => {
      // Chain row before activity row — the one lock order every writer that touches both shares.
      await trx
        .selectFrom('activityChains')
        .select('appendedChainIndex')
        .where('avatarId', '=', pinned.avatarId)
        .where('scopeType', '=', pinned.scopeType)
        .where('scopeId', '=', pinned.scopeId)
        .forUpdate()
        .execute();

      const capped = await trx
        .updateTable('activities')
        .set({ status: 'capped', stoppedAt: sql`now()` })
        .where('id', '=', input.targetActivityID)
        .where('appendedHead', '=', input.targetExpectedHead)
        .where('status', '=', 'active')
        .where((eb) =>
          eb.or([
            eb('writerSessionId', 'is', null),
            eb('writerSessionId', '=', input.actingSessionID),
          ]),
        )
        .returning('appendedHead')
        .executeTakeFirst();

      if (capped === undefined) {
        return { kind: 'resolved' as const, minted: await resolveLostRace(trx, pinned, input) };
      }

      await updateAppendedAnchorFromTail(trx, {
        activityId: input.targetActivityID,
        appendedHead: capped.appendedHead,
        avatarId: pinned.avatarId,
        scopeId: pinned.scopeId,
        scopeType: pinned.scopeType,
        startChainIndex: target.startChainIndex,
      });

      return { appendedHead: capped.appendedHead, kind: 'capped' as const };
    });

    if (capOutcome.kind === 'resolved') {
      return capOutcome.minted;
    }

    recordTerminalTransition('capped');

    throw new ContinuationBailError({
      activityID: input.targetActivityID,
      appendedHead: capOutcome.appendedHead,
      kind: 'capped',
    });
  }

  const outcome = await deps.db.transaction().execute(async (trx) => {
    // Chain row before activity row — the one lock order every writer that touches both shares.
    await trx
      .selectFrom('activityChains')
      .select('appendedChainIndex')
      .where('avatarId', '=', pinned.avatarId)
      .where('scopeType', '=', pinned.scopeType)
      .where('scopeId', '=', pinned.scopeId)
      .forUpdate()
      .execute();

    const updated = await trx
      .updateTable('activities')
      .set({
        appendedAt: sql`now()`,
        appendedHead: lastCheckpoint.version,
        appendedTimeMs: Math.floor(newTimeMs),
        lastHash: lastCheckpoint.hash,
        status: 'stopped',
        stoppedAt: sql`now()`,
        ...(input.actingSessionID !== null && { writerSessionId: input.actingSessionID }),
      })
      .where('id', '=', input.targetActivityID)
      .where('appendedHead', '=', input.targetExpectedHead)
      .where('status', '=', 'active')
      .where((eb) =>
        eb.or([
          eb('writerSessionId', 'is', null),
          eb('writerSessionId', '=', input.actingSessionID),
        ]),
      )
      .returning('appendedHead')
      .executeTakeFirst();

    if (updated === undefined) {
      return { kind: 'resolved' as const, minted: await resolveLostRace(trx, pinned, input) };
    }

    await trx
      .insertInto('activityCheckpoints')
      .values(
        input.continuation.checkpoints.map((checkpoint) => ({
          activityId: input.targetActivityID,
          hash: checkpoint.hash,
          payload: toJSON(checkpoint.payload),
          prevHash: checkpoint.prevHash,
          version: checkpoint.version,
        })),
      )
      .execute();

    await updateAppendedAnchorFromTail(trx, {
      activityId: input.targetActivityID,
      appendedHead: updated.appendedHead,
      avatarId: pinned.avatarId,
      scopeId: pinned.scopeId,
      scopeType: pinned.scopeType,
      startChainIndex: target.startChainIndex,
    });

    if (timeDelta > 0) {
      // the same debit formula the live append path uses, recomputed against the row's committed
      // values: each continuation commits its own transaction, so the next one's read already sees
      // this debit applied
      const debit = Math.ceil(timeDelta);
      const refill = sql`least(${deps.simTimeCapMs}, sim_budget_ms + (extract(epoch from (now() - sim_metered_at)) * 1000 * ${creditRate})::bigint)`;

      const consumed = await trx
        .updateTable('avatars')
        .set({ simBudgetMs: sql`${refill} - ${debit}`, simMeteredAt: sql`now()` })
        .where('id', '=', pinned.avatarId)
        .where((eb) => eb(refill, '>=', debit))
        .executeTakeFirst();

      invariant(consumed.numUpdatedRows > 0n, 'meter debit must apply once the append is won');
    }

    return { kind: 'stopped' as const, minted: await mintContinuation(trx, input, pinned) };
  });

  // Recorded only after the transaction commits: a statement failure after the guarded update
  // rolls the transition back, and a counter incremented inside the transaction would still count
  // it.
  if (outcome.kind === 'stopped') {
    recordTerminalTransition('stopped');
  }

  return outcome.minted;
}

async function resolveLostRace(
  trx: Kysely<DB>,
  pinned: Readonly<PinnedActivityContext>,
  input: Readonly<RunContinuationInput>,
): Promise<MintedContinuation> {
  const current = await trx
    .selectFrom('activities')
    .select(['appendedHead', 'lastHash', 'status', 'writerSessionId'])
    .where('id', '=', input.targetActivityID)
    .executeTakeFirst();

  invariant(current !== undefined, 'a continuation target row must exist once minted');

  const raceOutcome = pickCheckpointBatchRaceOutcome(
    input.actingSessionID,
    current,
    input.continuation.checkpoints,
  );

  if (raceOutcome.kind === 'resubmit-settled') {
    return mintContinuation(trx, input, pinned);
  }

  if (raceOutcome.kind === 'session-evicted') {
    throw new ContinuationBailError({
      activityID: input.targetActivityID,
      appendedHead: current.appendedHead,
      kind: 'session-evicted',
    });
  }

  if (raceOutcome.kind === 'terminal') {
    throw new ContinuationBailError({
      activityID: input.targetActivityID,
      appendedHead: raceOutcome.appendedHead,
      kind: 'terminal',
      status: raceOutcome.status,
    });
  }

  throw new ContinuationBailError({
    activityID: input.targetActivityID,
    appendedHead: current.appendedHead,
    avatarID: pinned.avatarId,
    kind: 'conflict',
    reason: 'stale-head',
  });
}
