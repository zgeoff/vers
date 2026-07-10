import { createServerFn } from '@tanstack/react-start';
import { onboardingHandler } from './onboarding-handler';

/**
 * The onboarding form's submit action; field-level validation happens once inside the handler.
 */
export const onboarding = createServerFn({ method: 'POST' })
  .validator((formData: unknown) => {
    if (!(formData instanceof FormData)) {
      throw new Error('onboarding expects a FormData submission');
    }

    return formData;
  })
  .handler((ctx) => onboardingHandler(ctx.data));
