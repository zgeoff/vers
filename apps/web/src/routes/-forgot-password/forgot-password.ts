import { createServerFn } from '@tanstack/react-start';
import { runForgotPassword } from './run-forgot-password';

/**
 * The forgot-password form's submit action; field-level validation happens once inside the handler.
 */
export const forgotPassword = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('forgotPassword expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => runForgotPassword(ctx.data));
