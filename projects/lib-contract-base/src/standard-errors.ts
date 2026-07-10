import * as z from 'zod';

/**
 * Why a session failed to authenticate; carried in the UNAUTHORIZED error payload.
 */
export const UnauthorizedReasonSchema = z.enum(['missing-session', 'expired-session']);

export type UnauthorizedReason = z.infer<typeof UnauthorizedReasonSchema>;

/**
 * Error vocabulary shared by every authenticated procedure. Declared once here so contracts never
 * redeclare `UNAUTHORIZED`/`FORBIDDEN` with slightly different shapes.
 */
export const STANDARD_ERRORS = {
  FORBIDDEN: {
    message: 'Insufficient permissions',

    // Deliberately empty: no permission model exists yet; fields are added additively when it lands.
    data: z.object({}),
  },
  UNAUTHORIZED: {
    data: z.object({ reason: UnauthorizedReasonSchema }),
    message: 'No valid session',
  },
} as const;
