import { pongoSingleStreamProjection } from '@event-driven-io/emmett-postgresql';
import type { ActivityEvent, ActivityProgressDoc } from './types';

/** Pongo collection (postgres table) the inline projection writes to. */
export const activityProgressCollection = 'activityProgress';

/**
 * Inline projection maintaining "latest progress for activity X", updated in
 * the same transaction as the append. Document id is the stream name.
 */
export const activityProgressProjection = pongoSingleStreamProjection<ActivityProgressDoc, ActivityEvent>({
  collectionName: activityProgressCollection,
  canHandle: ['ActivityStarted', 'CheckpointBatchRecorded', 'ActivityCompleted'],
  evolve: (document: ActivityProgressDoc | null, { type, data }: ActivityEvent): ActivityProgressDoc | null => {
    switch (type) {
      case 'ActivityStarted':
        return {
          activityId: data.activityId,
          status: 'active',
          progress: 0,
          lastHash: '',
          batchCount: 0,
          startedAt: data.startedAt,
          updatedAt: data.startedAt,
        };
      case 'CheckpointBatchRecorded':
        if (!document) return null;
        return {
          ...document,
          progress: data.progress,
          lastHash: data.hash,
          batchCount: document.batchCount + 1,
          updatedAt: data.recordedAt,
        };
      case 'ActivityCompleted':
        if (!document) return null;
        return {
          ...document,
          status: 'completed',
          progress: data.finalProgress,
          lastHash: data.hash,
          updatedAt: data.completedAt,
        };
    }
  },
});
