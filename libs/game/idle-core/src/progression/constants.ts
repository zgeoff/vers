/**
 * Tunable inputs for the XP and leveling curve. Values here are a placeholder shape standing in
 * for a designed curve — callers depend on the functions built from them, never these numbers
 * directly.
 */
export const XP_THRESHOLD_BASE = 100;

/**
 * Flat XP granted for completing an activity, before difficulty scaling.
 */
export const COMPLETION_BASE_XP = 25;

/**
 * Fraction of an avatar's progress into its current level lost on activity failure.
 */
export const FAILURE_XP_LOSS_FRACTION = 0.1;
