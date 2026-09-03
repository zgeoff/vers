import { createServerFn } from '@tanstack/react-start';
import { runLogin } from './run-login';

export const login = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('login expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => runLogin(ctx.data));
