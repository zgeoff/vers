import { createServerFn } from '@tanstack/react-start';
import { resetPasswordHandler } from './reset-password-handler';

export const resetPassword = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('resetPassword expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => resetPasswordHandler(ctx.data));
