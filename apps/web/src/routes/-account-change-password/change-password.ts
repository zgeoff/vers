import { createServerFn } from '@tanstack/react-start';
import { runChangePassword } from './run-change-password';

/**
 * The change-password form's submit action; field-level validation happens once inside the handler.
 */
export const changePassword = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('changePassword expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => runChangePassword(ctx.data));
