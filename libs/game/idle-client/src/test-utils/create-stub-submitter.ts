import { mock } from 'bun:test';
import type { CheckpointSubmitter } from '../submission/create-checkpoint-submitter';

export function createStubSubmitter(): CheckpointSubmitter {
  return {
    collectActivityStates: mock(() => []),
    flushHeld: mock(() => Promise.resolve()),
    flushNow: mock(() => Promise.resolve()),
    registerActivity: mock(() => Promise.resolve()),
    submit: mock(() => Promise.resolve<number | undefined>(undefined)),
    isEvicted: mock(() => false),
    removeEviction: mock(() => {}),
  };
}
