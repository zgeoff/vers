import * as z from 'zod';

/**
 * An avatar's economy mode, chosen once at creation: no procedure accepts a mode mutation.
 */
export const AvatarModeSchema = z.enum(['trade', 'self_found']);

export type AvatarMode = z.infer<typeof AvatarModeSchema>;
