import { createServerFn } from '@tanstack/react-start';
import { runLogin } from './run-login';

/**
 * The login form's submit action; field-level validation happens once inside the handler.
 */
export const login = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('login expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => runLogin(ctx.data));
