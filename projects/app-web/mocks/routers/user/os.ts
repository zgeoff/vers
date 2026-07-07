import { implement } from '@orpc/server';
import { userContract } from '@vers/contract-user';
import type { MockContext } from '../../resolve-session-context';

export const os = implement(userContract).$context<MockContext>();
