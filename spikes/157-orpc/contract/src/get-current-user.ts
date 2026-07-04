import { oc } from '@orpc/contract';
import * as z from 'zod';
import { UserSchema } from './user-schema';

/** Why a session failed to authenticate; carried in the UNAUTHORIZED error payload. */
export const UnauthorizedReasonSchema = z.enum([
  'missing-session',
  'expired-session',
]);

export type UnauthorizedReason = z.infer<typeof UnauthorizedReasonSchema>;

/** Returns the user attached to the caller's session. */
export const getCurrentUser = oc
  .route({
    method: 'GET',
    path: '/users/me',
    summary: 'Get the currently authenticated user',
  })
  .errors({
    UNAUTHORIZED: {
      message: 'No valid session',
      data: z.object({ reason: UnauthorizedReasonSchema }),
    },
  })
  .output(UserSchema);
