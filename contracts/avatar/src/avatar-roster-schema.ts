import * as z from 'zod';
import { AvatarDataSchema } from './avatar-data-schema';

/**
 * The caller's avatars together with the persisted active selection, answered as one shape so the
 * roster and the active answer can never disagree. `activeAvatarID` is null until the caller
 * selects an avatar or after the selected one is deleted.
 */
export const AvatarRosterSchema = z.object({
  activeAvatarID: z.string().nullable(),
  avatars: z.array(AvatarDataSchema),
});

export type AvatarRoster = z.infer<typeof AvatarRosterSchema>;
