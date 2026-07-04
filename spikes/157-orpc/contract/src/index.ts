import { getCurrentUser } from './get-current-user';

/** Contract for the user service. Implementations and clients both derive their types from this. */
export const userContract = {
  getCurrentUser,
};

export type UserContract = typeof userContract;

export {
  UnauthorizedReasonSchema,
  type UnauthorizedReason,
} from './get-current-user';
export { UserSchema, type User } from './user-schema';
