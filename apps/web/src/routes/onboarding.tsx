import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { AuthLayout } from '../components/auth-layout';
import { getHoneypotValidFrom } from '../lib/auth/get-honeypot-valid-from';
import { OnboardingForm } from './-onboarding/onboarding-form';
import { requireOnboardingSession } from './-onboarding/require-onboarding-session';

const requireOnboardingSessionFn = createServerFn({ method: 'GET' }).handler(() =>
  requireOnboardingSession(),
);

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
  head: () => ({ meta: [{ title: 'vers | Onboarding' }] }),
  loader: async () => {
    await requireOnboardingSessionFn();

    return { honeypotValidFrom: await getHoneypotValidFrom() };
  },
});

function OnboardingPage() {
  const loaderData = Route.useLoaderData();

  return (
    <AuthLayout>
      <OnboardingForm honeypotValidFrom={loaderData.honeypotValidFrom} />
    </AuthLayout>
  );
}
