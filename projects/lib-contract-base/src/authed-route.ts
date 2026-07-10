import { oc } from '@orpc/contract';
import { STANDARD_ERRORS } from './standard-errors';

/**
 * Base contract builder for procedures that require an authenticated acting user.
 */
export const authedRoute = oc.errors(STANDARD_ERRORS);
