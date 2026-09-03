import { createServerFn } from '@tanstack/react-start';
import { runAvatarCreate } from './run-avatar-create';

export const avatarCreate = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('avatarCreate expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => runAvatarCreate(ctx.data));
