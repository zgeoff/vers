import { buildStateFromSeed } from '@vers/game-utils';
import { ActivityFailureAction } from '../types';
import type { CorpusCase } from './types';

// every seed, difficulty, and starting build below is a frozen literal: the golden digests in
// run-corpus.test.ts are only a regression guard while these inputs never move
export const CORPUS_CASES: ReadonlyArray<CorpusCase> = Object.freeze([
  {
    id: 'clean-completion',
    contentID: 'baseline',

    // the driver restarts a completed activity when duration remains, so this stops exactly at
    // the run's own completion instant rather than rolling into a second clear
    durationMs: 62_600,
    failureAction: ActivityFailureAction.Abort,
    source: {
      avatarID: 'avatar-golden-completed',
      buildSnapshot: { level: 10, xp: 0 },
      contentVersion: '1',
      encounterNode: { difficulty: 1 },
      id: 'activity-golden-completed',
      seed: buildStateFromSeed(1_111_111),
    },
  },
  {
    id: 'aborted-failure',
    contentID: 'baseline',
    durationMs: 10_000,
    failureAction: ActivityFailureAction.Abort,
    source: {
      avatarID: 'avatar-golden-failed',
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '1',
      encounterNode: { difficulty: 12 },
      id: 'activity-golden-failed',
      seed: buildStateFromSeed(2_222_222),
    },
  },
  {
    id: 'same-tick-multi-enemy-avatar-death',
    contentID: 'baseline',
    durationMs: 20_000,
    failureAction: ActivityFailureAction.Abort,
    source: {
      avatarID: 'avatar-golden-divergence',
      buildSnapshot: { level: 2, xp: 0 },
      contentVersion: '1',
      encounterNode: { difficulty: 8 },
      id: 'activity-golden-divergence',
      seed: buildStateFromSeed(4),
    },
  },
  {
    id: 'retrying-multi-attempt',
    contentID: 'baseline',
    durationMs: 120_000,
    failureAction: ActivityFailureAction.Retry,
    source: {
      avatarID: 'avatar-golden-retry',
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '1',
      encounterNode: { difficulty: 12 },
      id: 'activity-golden-retry',
      seed: buildStateFromSeed(3_333_333),
    },
  },
  {
    id: 'multi-clear',
    contentID: 'baseline',
    durationMs: 120_000,
    failureAction: ActivityFailureAction.Abort,
    source: {
      avatarID: 'avatar-golden-clears',
      buildSnapshot: { level: 10, xp: 0 },
      contentVersion: '1',
      encounterNode: { difficulty: 1 },
      id: 'activity-golden-clears',
      seed: buildStateFromSeed(4_444_444),
    },
  },
  {
    id: 'event-tie-failed-short',
    contentID: 'fast-attack',
    durationMs: 30_000,
    failureAction: ActivityFailureAction.Abort,
    source: {
      avatarID: 'avatar-corpus-event-tie-failed-short',
      buildSnapshot: { level: 5, xp: 0 },
      contentVersion: '2',
      encounterNode: { difficulty: 3 },
      id: 'activity-corpus-event-tie-failed-short',
      seed: buildStateFromSeed(1),
    },
  },
  {
    id: 'event-tie-failed-long',
    contentID: 'fast-attack',
    durationMs: 30_000,
    failureAction: ActivityFailureAction.Abort,
    source: {
      avatarID: 'avatar-corpus-event-tie-failed-long',
      buildSnapshot: { level: 5, xp: 0 },
      contentVersion: '2',
      encounterNode: { difficulty: 3 },
      id: 'activity-corpus-event-tie-failed-long',
      seed: buildStateFromSeed(8),
    },
  },
  {
    id: 'event-tie-progress-cutoff',
    contentID: 'fast-attack',
    durationMs: 30_000,
    failureAction: ActivityFailureAction.Abort,
    source: {
      avatarID: 'avatar-corpus-event-tie-progress-cutoff',
      buildSnapshot: { level: 5, xp: 0 },
      contentVersion: '2',
      encounterNode: { difficulty: 3 },
      id: 'activity-corpus-event-tie-progress-cutoff',
      seed: buildStateFromSeed(2),
    },
  },
  {
    id: 'threshold-one-below',
    contentID: 'baseline',
    durationMs: 15_000,
    failureAction: ActivityFailureAction.Abort,
    source: {
      avatarID: 'avatar-corpus-threshold-one-below',
      buildSnapshot: { level: 1, xp: 99 },
      contentVersion: '1',
      encounterNode: { difficulty: 1 },
      id: 'activity-corpus-threshold-one-below',
      seed: buildStateFromSeed(7_654_321),
    },
  },
  {
    id: 'threshold-exact',
    contentID: 'baseline',
    durationMs: 15_000,
    failureAction: ActivityFailureAction.Abort,
    source: {
      avatarID: 'avatar-corpus-threshold-exact',
      buildSnapshot: { level: 1, xp: 90 },
      contentVersion: '1',
      encounterNode: { difficulty: 1 },
      id: 'activity-corpus-threshold-exact',
      seed: buildStateFromSeed(7_654_321),
    },
  },
  {
    id: 'repeated-retry-long-a',
    contentID: 'baseline',
    durationMs: 300_000,
    failureAction: ActivityFailureAction.Retry,
    source: {
      avatarID: 'avatar-corpus-repeated-retry-long-a',
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '1',
      encounterNode: { difficulty: 12 },
      id: 'activity-corpus-repeated-retry-long-a',
      seed: buildStateFromSeed(8_888_888),
    },
  },
  {
    id: 'repeated-retry-long-b',
    contentID: 'baseline',
    durationMs: 300_000,
    failureAction: ActivityFailureAction.Retry,
    source: {
      avatarID: 'avatar-corpus-repeated-retry-long-b',
      buildSnapshot: { level: 1, xp: 0 },
      contentVersion: '1',
      encounterNode: { difficulty: 15 },
      id: 'activity-corpus-repeated-retry-long-b',
      seed: buildStateFromSeed(9_999_999),
    },
  },
]);
