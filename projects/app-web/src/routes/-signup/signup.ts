import { createServerFn } from '@tanstack/react-start';
import { signupHandler } from './signup-handler';

/** The signup form's submit action; field-level validation happens once inside the handler. */
export const signup = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('signup expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => signupHandler(ctx.data));
