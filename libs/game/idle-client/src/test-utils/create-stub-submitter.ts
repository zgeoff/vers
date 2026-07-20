import { mock } from 'bun:test';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';

/**
 * A no-op checkpoint submitter whose members are spies, so a test can assert which submission
 * calls a handler made without running the real flush pipeline.
 */
export function createStubSubmitter(): CheckpointSubmitter {
  return {
    flushHeld: mock(() => Promise.resolve()),
    flushNow: mock(() => Promise.resolve()),
    registerActivity: mock(() => Promise.resolve()),
    submit: mock(() => Promise.resolve<number | undefined>(undefined)),
  };
}
