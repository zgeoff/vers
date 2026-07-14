import { implement } from '@orpc/server';
import { replayContract } from '@vers/contract-replay';
import type { MockContext } from '../resolve-session-context';

export const os = implement(replayContract).$context<MockContext>();
