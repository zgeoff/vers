import { createServerFn } from '@tanstack/react-start';
import { runSignup } from './run-signup';

export const signup = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new TypeError('signup expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => runSignup(ctx.data));
