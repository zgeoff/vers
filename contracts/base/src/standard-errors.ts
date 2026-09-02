import * as z from 'zod';
import { defineErrors } from './define-errors';

export const UnauthorizedReasonSchema = z.enum(['missing-session', 'expired-session']);

export type UnauthorizedReason = z.infer<typeof UnauthorizedReasonSchema>;

export const STANDARD_ERRORS = defineErrors({
  FORBIDDEN: {
    message: 'Insufficient permissions',

    // Deliberately empty: there is no permission model to describe; permission fields would extend this shape additively.
    data: z.object({}),
  },
  UNAUTHORIZED: {
    data: z.object({ reason: UnauthorizedReasonSchema }),
    message: 'No valid session',
  },
});
