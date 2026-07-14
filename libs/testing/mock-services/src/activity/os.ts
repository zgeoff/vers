import { implement } from '@orpc/server';
import { activityContract } from '@vers/contract-activity';
import type { MockContext } from '../resolve-session-context';

export const os = implement(activityContract).$context<MockContext>();
