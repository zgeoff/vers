import * as z from 'zod';

/**
 * An avatar's economy mode, chosen once at creation and never mutated: it fixes key custody and
 * partitions every economic container the avatar touches.
 */
export const AvatarModeSchema = z.enum(['trade', 'self_found']);

export type AvatarMode = z.infer<typeof AvatarModeSchema>;
