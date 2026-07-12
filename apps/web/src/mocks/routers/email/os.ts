import { implement } from '@orpc/server';
import { emailContract } from '@vers/contract-email';
import type { MockContext } from '../../resolve-session-context';

export const os = implement(emailContract).$context<MockContext>();
