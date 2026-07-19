import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { ScreenLayout } from '../components/screen-layout';
import { getAccountContent } from '../lib/account/get-account-content';
import { requireAuth } from '../lib/auth/require-auth';
import { AccountScreen } from './-account/account-screen';

const requireAuthFn = createServerFn({ method: 'GET' }).handler(() => requireAuth());

export const Route = createFileRoute('/account')({
  component: AccountPage,
  head: () => ({ meta: [{ title: 'vers | Account' }] }),
  loader: async () => {
    await requireAuthFn();

    const accountContent = await getAccountContent();

    return { Content: accountContent.Renderable, has2FA: accountContent.has2FA };
  },
});

function AccountPage() {
  const data = Route.useLoaderData();

  return (
    <ScreenLayout title="Account">
      <AccountScreen Content={data.Content} has2FA={data.has2FA} />
    </ScreenLayout>
  );
}
