import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { AuthLayout } from '../components/auth-layout';
import { requireAnonymous } from '../lib/auth/require-anonymous';
import { LoginForm } from './-login/login-form';
import { LoginSearchSchema } from './-login/login-search-schema';

const requireAnonymousFn = createServerFn({ method: 'GET' }).handler(() => requireAnonymous());

export const Route = createFileRoute('/login')({
  component: LoginPage,
  head: () => ({ meta: [{ title: 'vers | Login' }] }),
  loader: () => requireAnonymousFn(),
  validateSearch: (search) => LoginSearchSchema.parse(search),
});

function LoginPage() {
  const search = Route.useSearch();

  return (
    <AuthLayout>
      <LoginForm redirectTo={search.redirect} />
    </AuthLayout>
  );
}
