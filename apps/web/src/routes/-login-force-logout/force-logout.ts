import { createServerFn } from '@tanstack/react-start';
import { runForceLogout } from './run-force-logout';

/**
 * The force-logout page's confirm/cancel submit action.
 */
export const forceLogout = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('forceLogout expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => runForceLogout(ctx.data));
