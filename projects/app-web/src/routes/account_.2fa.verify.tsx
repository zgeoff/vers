import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { TwoFactorSetupForm } from './-account-2fa-verify/two-factor-setup-form';
import { twoFactorSetupLoader } from './-account-2fa-verify/two-factor-setup-loader';

const twoFactorSetupLoaderFn = createServerFn({ method: 'GET' }).handler(() =>
  twoFactorSetupLoader(),
);

export const Route = createFileRoute('/account_/2fa/verify')({
  component: TwoFactorSetupPage,
  head: () => ({ meta: [{ title: 'vers | Enable 2FA' }] }),
  loader: () => twoFactorSetupLoaderFn(),
});

function TwoFactorSetupPage() {
  const data = Route.useLoaderData();

  return <TwoFactorSetupForm {...data} />;
}
