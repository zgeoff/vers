import { createFileRoute, redirect } from '@tanstack/react-router';
import { VerificationTypeSchema } from '@vers/contract-verification';
import { AuthLayout } from '../components/auth-layout';
import { getHoneypotValidFrom } from '../lib/auth/get-honeypot-valid-from';
import { VerifyOTPForm } from './-verify-otp/verify-otp-form';
import { VerifyOTPSearchSchema } from './-verify-otp/verify-otp-search-schema';

export const Route = createFileRoute('/verify-otp')({
  component: VerifyOTPPage,
  head: () => ({ meta: [{ title: 'vers | Verify OTP' }] }),
  loader: async (opts) => {
    const search = VerifyOTPSearchSchema.parse(opts.location.search);

    if (!VerificationTypeSchema.safeParse(search.type).success) {
      throw redirect({ href: '/' });
    }

    return { honeypotValidFrom: await getHoneypotValidFrom() };
  },
  validateSearch: (search) => VerifyOTPSearchSchema.parse(search),
});

function VerifyOTPPage() {
  const loaderData = Route.useLoaderData();
  const search = Route.useSearch();
  const type = VerificationTypeSchema.parse(search.type);

  return (
    <AuthLayout>
      <VerifyOTPForm
        code={search.code}
        honeypotValidFrom={loaderData.honeypotValidFrom}
        redirectTo={search.redirect}
        target={search.target ?? ''}
        type={type}
      />
    </AuthLayout>
  );
}
