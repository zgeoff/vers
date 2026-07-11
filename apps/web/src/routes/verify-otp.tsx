import { createFileRoute, redirect } from '@tanstack/react-router';
import { VerificationTypeSchema } from '@vers/contract-verification';
import { VerifyOTPForm } from './-verify-otp/verify-otp-form';
import { VerifyOTPSearchSchema } from './-verify-otp/verify-otp-search-schema';

export const Route = createFileRoute('/verify-otp')({
  component: VerifyOTPPage,
  head: () => ({ meta: [{ title: 'vers | Verify OTP' }] }),
  loader: (opts) => {
    const search = VerifyOTPSearchSchema.parse(opts.location.search);

    if (!VerificationTypeSchema.safeParse(search.type).success) {
      throw redirect({ href: '/' });
    }
  },
  validateSearch: (search) => VerifyOTPSearchSchema.parse(search),
});

function VerifyOTPPage() {
  const search = Route.useSearch();
  const type = VerificationTypeSchema.parse(search.type);

  return <VerifyOTPForm redirectTo={search.redirect} target={search.target ?? ''} type={type} />;
}
