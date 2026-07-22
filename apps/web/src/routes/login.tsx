import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { AuthLayout } from '../components/auth-layout';
import { getHoneypotValidFrom } from '../lib/auth/get-honeypot-valid-from';
import { requireAnonymous } from '../lib/auth/require-anonymous';
import { LoginForm } from './-login/login-form';
import { LoginSearchSchema } from './-login/login-search-schema';

const requireAnonymousFn = createServerFn({ method: 'GET' }).handler(() => requireAnonymous());

export const Route = createFileRoute('/login')({
  component: LoginPage,
  head: () => ({ meta: [{ title: 'vers | Login' }] }),
  loader: async () => {
    await requireAnonymousFn();

    return { honeypotValidFrom: await getHoneypotValidFrom() };
  },
  validateSearch: (search) => LoginSearchSchema.parse(search),
});

function LoginPage() {
  const loaderData = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <AuthLayout>
      <LoginForm honeypotValidFrom={loaderData.honeypotValidFrom} redirectTo={search.redirect} />
    </AuthLayout>
  );
}
