import { createServerFn } from '@tanstack/react-start';
import { runOnboarding } from './run-onboarding';

export const onboarding = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('onboarding expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => runOnboarding(ctx.data));
