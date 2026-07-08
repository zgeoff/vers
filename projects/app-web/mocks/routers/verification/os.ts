import { implement } from '@orpc/server';
import { verificationContract } from '@vers/contract-verification';
import type { MockContext } from '../../resolve-session-context';

export const os = implement(verificationContract).$context<MockContext>();
