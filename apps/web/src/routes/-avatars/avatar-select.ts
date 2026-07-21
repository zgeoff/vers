import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { runAvatarSelect } from './run-avatar-select';

const AvatarSelectInputSchema = z.object({ avatarID: z.string() });

export const avatarSelect = createServerFn({ method: 'POST' })
  .validator((input: unknown) => AvatarSelectInputSchema.parse(input))
  .handler((ctx) => runAvatarSelect(ctx.data.avatarID));
