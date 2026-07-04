import { event, projections, STREAM_DOES_NOT_EXIST } from '@event-driven-io/emmett';
import { getPostgreSQLEventStore } from '@event-driven-io/emmett-postgresql';
import { pongoClient } from '@event-driven-io/pongo';
import { activityProgressCollection, activityProgressProjection } from './activity-progress-projection';
import { buildCheckpointHash } from './build-checkpoint-hash';
import { buildGenesisHash } from './build-genesis-hash';
import { checkHashChain } from './check-hash-chain';
import { toActivityStreamName } from './to-activity-stream-name';
import type { ActivityEvent, ActivityProgressDoc, ActivityStarted, Checkpoint, CheckpointBatchRecorded } from './types';

export type ActivityStore = ReturnType<typeof createActivityStore>;

/**
 * The spike's whole surface: emmett postgres event store with the inline
 * progress projection, plus the append / point-read / replay operations the
 * probe exercises. One instance per process; `close` tears down both pools.
 */
export function createActivityStore(connectionString: string) {
  const eventStore = getPostgreSQLEventStore(connectionString, {
    projections: projections.inline([activityProgressProjection]),
  });
  const pongo = pongoClient(connectionString);
  const progressCollection = pongo.db().collection<ActivityProgressDoc>(activityProgressCollection);

  return {
    eventStore,

    async createActivityStream(input: { activityId: string; seed: string; difficulty: number }) {
      const started = event<ActivityStarted>('ActivityStarted', {
        ...input,
        startedAt: new Date().toISOString(),
      });
      const result = await eventStore.appendToStream(toActivityStreamName(input.activityId), [started], {
        expectedStreamVersion: STREAM_DOES_NOT_EXIST,
      });
      return {
        genesisHash: buildGenesisHash(input.activityId, input.seed),
        nextExpectedStreamVersion: result.nextExpectedStreamVersion,
      };
    },

    async appendCheckpointBatch(input: {
      activityId: string;
      checkpoints: Checkpoint[];
      progress: number;
      prevHash: string;
      expectedStreamVersion: bigint;
    }) {
      const hash = buildCheckpointHash(input.prevHash, {
        checkpoints: input.checkpoints,
        progress: input.progress,
      });
      const recorded = event<CheckpointBatchRecorded>('CheckpointBatchRecorded', {
        checkpoints: input.checkpoints,
        progress: input.progress,
        prevHash: input.prevHash,
        hash,
        recordedAt: new Date().toISOString(),
      });
      const result = await eventStore.appendToStream(toActivityStreamName(input.activityId), [recorded], {
        expectedStreamVersion: input.expectedStreamVersion,
      });
      return { hash, nextExpectedStreamVersion: result.nextExpectedStreamVersion };
    },

    async readProgress(activityId: string): Promise<ActivityProgressDoc | null> {
      return progressCollection.findOne({ _id: toActivityStreamName(activityId) });
    },

    async replayActivity(activityId: string) {
      const result = await eventStore.readStream<ActivityEvent>(toActivityStreamName(activityId));
      return {
        streamExists: result.streamExists,
        currentStreamVersion: result.currentStreamVersion,
        eventCount: result.events.length,
        chain: checkHashChain(result.events),
      };
    },

    async close() {
      await eventStore.close();
      await pongo.close();
    },
  };
}
