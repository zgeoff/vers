import { AvatarModeSchema, AvatarNameSchema } from '@vers/contract-avatar';
import * as z from 'zod';

export const AvatarCreateFormSchema = z.object({
  mode: AvatarModeSchema.default('trade'),
  name: AvatarNameSchema,
});

export type AvatarCreateFormInput = z.infer<typeof AvatarCreateFormSchema>;
