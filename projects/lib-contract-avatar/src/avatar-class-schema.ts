import { Class } from '@vers/data';
import * as z from 'zod';

/**
 * An avatar's class, sourced from the game's canonical class list.
 */
export const AvatarClassSchema = z.enum(Class);

export type AvatarClass = z.infer<typeof AvatarClassSchema>;
