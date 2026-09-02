import { createServerFn } from '@tanstack/react-start';
import { runForgotPassword } from './run-forgot-password';

export const forgotPassword = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('forgotPassword expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => runForgotPassword(ctx.data));
