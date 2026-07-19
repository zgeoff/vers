import * as z from 'zod';
import { defineErrors } from './define-errors';

/**
 * Why a session failed to authenticate; carried in the UNAUTHORIZED error payload.
 */
export const UnauthorizedReasonSchema = z.enum(['missing-session', 'expired-session']);

export type UnauthorizedReason = z.infer<typeof UnauthorizedReasonSchema>;

/**
 * Error vocabulary shared by every authenticated procedure. Declared once here so contracts never
 * redeclare `UNAUTHORIZED`/`FORBIDDEN` with slightly different shapes.
 */
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
