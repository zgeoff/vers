import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { AuthLayout } from '../components/auth-layout';
import { getHoneypotValidFrom } from '../lib/auth/get-honeypot-valid-from';
import { requireAnonymous } from '../lib/auth/require-anonymous';
import { SignupForm } from './-signup/signup-form';
import { SignupSearchSchema } from './-signup/signup-search-schema';

const requireAnonymousFn = createServerFn({ method: 'GET' }).handler(() => requireAnonymous());

export const Route = createFileRoute('/signup')({
  component: SignupPage,
  head: () => ({ meta: [{ title: 'vers | Signup' }] }),
  loader: async () => {
    await requireAnonymousFn();

    return { honeypotValidFrom: await getHoneypotValidFrom() };
  },
  validateSearch: (search) => SignupSearchSchema.parse(search),
});

function SignupPage() {
  const loaderData = Route.useLoaderData();
  const search = Route.useSearch();

  return (
    <AuthLayout>
      <SignupForm honeypotValidFrom={loaderData.honeypotValidFrom} reason={search.reason} />
    </AuthLayout>
  );
}
