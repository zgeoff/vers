import { oc } from '@orpc/contract';
import { STANDARD_ERRORS } from './standard-errors';

export const authedRoute = oc.errors(STANDARD_ERRORS);
