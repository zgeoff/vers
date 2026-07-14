import { implement } from '@orpc/server';
import { sessionContract } from '@vers/contract-session';
import type { MockContext } from '../resolve-session-context';

export const os = implement(sessionContract).$context<MockContext>();
