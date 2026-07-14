import { implement } from '@orpc/server';
import { keysContract } from '@vers/contract-keys';
import type { MockContext } from '../resolve-session-context';

export const os = implement(keysContract).$context<MockContext>();
