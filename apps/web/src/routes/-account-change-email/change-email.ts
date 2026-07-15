import { createServerFn } from '@tanstack/react-start';
import { runChangeEmail } from './run-change-email';

/**
 * The change-email form's submit action; field-level validation happens once inside the handler.
 */
export const changeEmail = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('changeEmail expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => runChangeEmail(ctx.data));
