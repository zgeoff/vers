import { createServerFn } from '@tanstack/react-start';
import { forceLogoutHandler } from './force-logout-handler';

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
  .handler((ctx) => forceLogoutHandler(ctx.data));
