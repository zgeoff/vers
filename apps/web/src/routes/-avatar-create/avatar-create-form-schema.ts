import { AvatarClassSchema, AvatarNameSchema } from '@vers/contract-avatar';
import * as z from 'zod';

export const AvatarCreateFormSchema = z.object({
  class: AvatarClassSchema,
  name: AvatarNameSchema,
});

export type AvatarCreateFormInput = z.infer<typeof AvatarCreateFormSchema>;
