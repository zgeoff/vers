/**
 * How long a minted access token remains valid.
 */
export const ACCESS_TOKEN_DURATION = 15 * 60 * 1000; // 15 minutes

/**
 * Default session lifetime for a login without `rememberMe`.
 */
export const SESSION_DURATION_SHORT = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Session lifetime for a login with `rememberMe`.
 */
export const SESSION_DURATION_LONG = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * A step-up transaction is abandoned after this many failed verification attempts.
 */
export const MAX_TRANSACTION_ATTEMPTS = 5;

/**
 * How long a pending step-up transaction stays consumable before it's swept as expired.
 */
export const PENDING_TRANSACTION_TTL = 5 * 60 * 1000; // 5 minutes
