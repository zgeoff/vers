import { createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import * as z from 'zod';
import { AuthLayout } from '../components/auth-layout';
import { requireResetPasswordAccess } from './-reset-password/require-reset-password-access';
import { ResetPasswordForm } from './-reset-password/reset-password-form';

const requireResetPasswordAccessFn = createServerFn({ method: 'GET' })
  .validator((search: Readonly<Record<string, unknown>>) => search)
  .handler((ctx) => requireResetPasswordAccess(ctx.data));

const ResetPasswordSearchSchema = z.object({
  email: z.string().optional(),
  token: z.string().optional(),
});

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: 'vers | Reset Password' }] }),
  loader: (opts) => requireResetPasswordAccessFn({ data: opts.location.search }),
  validateSearch: (search) => ResetPasswordSearchSchema.parse(search),
});

function ResetPasswordPage() {
  const loaderData = Route.useLoaderData();

  return (
    <AuthLayout>
      <ResetPasswordForm email={loaderData.email} resetToken={loaderData.resetToken} />
    </AuthLayout>
  );
}
