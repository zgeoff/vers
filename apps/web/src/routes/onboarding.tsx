import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { OnboardingForm } from './-onboarding/onboarding-form';
import { requireOnboardingSession } from './-onboarding/require-onboarding-session';

const requireOnboardingSessionFn = createServerFn({ method: 'GET' }).handler(() =>
  requireOnboardingSession(),
);

export const Route = createFileRoute('/onboarding')({
  component: OnboardingForm,
  head: () => ({ meta: [{ title: 'vers | Onboarding' }] }),
  loader: () => requireOnboardingSessionFn(),
});
