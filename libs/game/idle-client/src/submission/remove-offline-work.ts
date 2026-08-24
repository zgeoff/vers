import {
  CHECKPOINT_QUEUE_STORE_NAME,
  PENDING_ACTIVITY_STARTS_STORE_NAME,
  PREFERENCES_STORE_NAME,
} from './constants';
import { resolveCheckpointQueueDB } from './resolve-checkpoint-queue-db';

/**
 * Discards every trace of this device's undelivered offline work: the client-minted activity starts
 * the server has never seen, the checkpoints queued behind them, and the preferences a recovery
 * would steer by. Called once the device learns its session row is gone — another device took the
 * account over, or this one signed out — after which nothing this session played can ever reach the
 * server, and holding it risks delivering it under whichever account signs in next.
 *
 * The three stores clear in one transaction, so a recovery racing the discard never observes an
 * activity start whose queued checkpoints have already gone.
 *
 * The cached node seeds and content documents survive. They are re-fetchable inputs rather than
 * work awaiting delivery, and a seed row's key names the avatar that owns it, so a later account
 * matches none of them.
 */
export async function removeOfflineWork(): Promise<void> {
  const db = await resolveCheckpointQueueDB();

  const transaction = db.transaction(
    [CHECKPOINT_QUEUE_STORE_NAME, PENDING_ACTIVITY_STARTS_STORE_NAME, PREFERENCES_STORE_NAME],
    'readwrite',
  );

  await Promise.all([
    transaction.objectStore(CHECKPOINT_QUEUE_STORE_NAME).clear(),
    transaction.objectStore(PENDING_ACTIVITY_STARTS_STORE_NAME).clear(),
    transaction.objectStore(PREFERENCES_STORE_NAME).clear(),
    transaction.done,
  ]);
}
