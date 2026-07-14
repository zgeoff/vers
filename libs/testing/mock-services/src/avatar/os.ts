import { implement } from '@orpc/server';
import { avatarContract } from '@vers/contract-avatar';
import type { MockContext } from '../resolve-session-context';

export const os = implement(avatarContract).$context<MockContext>();
