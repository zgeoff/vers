import { createServerFn } from '@tanstack/react-start';
import { runForceLogout } from './run-force-logout';

export const forceLogout = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('forceLogout expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => runForceLogout(ctx.data));
