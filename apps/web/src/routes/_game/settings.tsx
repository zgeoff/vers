import { createFileRoute } from '@tanstack/react-router';
import { SettingsScreen } from '../-settings/settings-screen';
import { getAccountContent } from '../../lib/account/get-account-content';
import { readWithLastKnown } from '../../lib/offline/read-with-last-known';

export const Route = createFileRoute('/_game/settings')({
  component: SettingsPage,
  head: () => ({ meta: [{ title: 'vers | Settings' }] }),
  loader: async (opts) => {
    const accountContent = await readWithLastKnown(
      opts.context.queryClient,
      'account-content',
      () => getAccountContent(),
    );

    return { Content: accountContent.Renderable, has2FA: accountContent.has2FA };
  },
  staticData: { presentation: 'ambient' },
});

function SettingsPage() {
  const data = Route.useLoaderData();

  return <SettingsScreen Content={data.Content} has2FA={data.has2FA} />;
}
