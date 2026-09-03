import * as z from 'zod';

export const AvatarModeSchema = z.enum(['trade', 'self_found']);

export type AvatarMode = z.infer<typeof AvatarModeSchema>;
