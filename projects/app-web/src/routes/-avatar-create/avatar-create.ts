import { createServerFn } from '@tanstack/react-start';
import { avatarCreateHandler } from './avatar-create-handler';

/** The avatar-create form's submit action; field-level validation happens once inside the handler. */
export const avatarCreate = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('avatarCreate expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => avatarCreateHandler(ctx.data));
