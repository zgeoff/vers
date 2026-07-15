import * as z from 'zod';

/**
 * An activity scope identifier (`scopeType`, `scopeID`): an opaque, bounded token restricted to
 * URL/path-safe characters. The character bound keeps it free of the reward-position `|` separator
 * and well-formed by construction, so it feeds the frozen reward-position encoding without any
 * escaping.
 */
export const ScopeIdentifierSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_.-]+$/);
