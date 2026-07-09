import { createServerFn } from '@tanstack/react-start';
import { avatarCreateHandler } from './avatar-create-handler';

/**
 * Field-level validation runs inside the submission handler, not this FormData type guard.
 */
export const avatarCreate = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('avatarCreate expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => avatarCreateHandler(ctx.data));
