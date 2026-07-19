import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { AuthLayout } from '../components/auth-layout';
import { OnboardingForm } from './-onboarding/onboarding-form';
import { requireOnboardingSession } from './-onboarding/require-onboarding-session';

const requireOnboardingSessionFn = createServerFn({ method: 'GET' }).handler(() =>
  requireOnboardingSession(),
);

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
  head: () => ({ meta: [{ title: 'vers | Onboarding' }] }),
  loader: () => requireOnboardingSessionFn(),
});

function OnboardingPage() {
  return (
    <AuthLayout>
      <OnboardingForm />
    </AuthLayout>
  );
}
