import { Brand, Heading, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { Link as RRLink } from 'react-router';
import { Link } from '~/components/link';
import { RouteErrorBoundary } from '~/components/route-error-boundary';
import { Routes } from '~/types';
import { requireAnonymous } from '~/utils/require-anonymous.server';
import { withErrorHandling } from '~/utils/with-error-handling';
import type { Route } from './+types/route';

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    {
      description: '',
      title: 'vers | Reset Password',
    },
  ];
}

export const loader = withErrorHandling(async (args: Route.LoaderArgs) => {
  await requireAnonymous(args.request);
});

const pageInfo = css({
  marginBottom: '8',
  textAlign: 'center',
});

export function ResetPasswordStarted() {
  return (
    <>
      <section className={pageInfo}>
        <RRLink to={Routes.Index}>
          <Brand size="xl" />
        </RRLink>
        <Heading level={2}>Check your email</Heading>
        <Text>
          If an account exists with that email address, we&apos;ve sent you instructions on how to
          reset your password.
        </Text>
      </section>
      <Text>
        Can&apos;t find the email? Check your spam folder or{' '}
        <Link to={Routes.ForgotPassword}>try requesting another one</Link>.
      </Text>
    </>
  );
}

export function ErrorBoundary() {
  return <RouteErrorBoundary />;
}

export default ResetPasswordStarted;
