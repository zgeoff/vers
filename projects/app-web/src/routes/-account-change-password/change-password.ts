import { createServerFn } from '@tanstack/react-start';
import { changePasswordHandler } from './change-password-handler';

/** The change-password form's submit action; field-level validation happens once inside the handler. */
export const changePassword = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('changePassword expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => changePasswordHandler(ctx.data));
