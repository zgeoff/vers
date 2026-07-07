import { Link, createFileRoute } from '@tanstack/react-router';
import { createServerFn } from '@tanstack/react-start';
import { Brand, Heading, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { requireAnonymous } from '../lib/auth/require-anonymous';

const requireAnonymousFn = createServerFn({ method: 'GET' }).handler(() => requireAnonymous());

export const Route = createFileRoute('/reset-password-started')({
  component: ResetPasswordStarted,
  head: () => ({ meta: [{ title: 'vers | Reset Password' }] }),
  loader: () => requireAnonymousFn(),
});

const pageInfo = css({ marginBottom: '8', textAlign: 'center' });

/** A pure server component: a confirmation page with no client-interactive parts. */
function ResetPasswordStarted() {
  return (
    <>
      <section className={pageInfo}>
        <Link to="/">
          <Brand size="xl" />
        </Link>
        <Heading level={2}>Check your email</Heading>
        <Text>
          If an account exists with that email address, we&apos;ve sent you instructions on how to
          reset your password.
        </Text>
      </section>
      <Text>
        Can&apos;t find the email? Check your spam folder or{' '}
        <Link to="/forgot-password">try requesting another one</Link>.
      </Text>
    </>
  );
}
