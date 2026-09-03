import * as z from 'zod';
import { AvatarDataSchema } from './avatar-data-schema';

export const AvatarRosterSchema = z.object({
  activeAvatarID: z.string().nullable(),
  avatars: z.array(AvatarDataSchema),
});

export type AvatarRoster = z.infer<typeof AvatarRosterSchema>;
