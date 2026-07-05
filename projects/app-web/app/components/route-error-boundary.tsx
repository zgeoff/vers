import { captureException } from '@sentry/react';
import { Brand, Button, Heading, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useEffect } from 'react';
import { Form, isRouteErrorResponse, useRouteError } from 'react-router';
import { Routes } from '../types';
import { getErrorMessage } from '../utils/get-error-message';
import { Link } from './link';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const isRouteError = isRouteErrorResponse(error);

  useEffect(() => {
    if (!isRouteError) {
      captureException(error);
    }
  }, [error, isRouteError]);

  if (isRouteError && error.status === 404) {
    return (
      <ErrorBoundaryContainer>
        <Heading level={2}>We couldn&apos;t find what you were looking for</Heading>
        <Text>
          The page you are looking for does not exist. It might have been moved or deleted.
        </Text>
      </ErrorBoundaryContainer>
    );
  }

  const errorMessage =
    process.env['NODE_ENV'] === 'production' ? (
      <Text>
        Sorry, an unknown error occurred. Please try again later. If the problem persists, please{' '}
        <Link to={Routes.Contact}>contact support</Link>.
      </Text>
    ) : (
      <Text>{getErrorMessage(error)}</Text>
    );

  return (
    <ErrorBoundaryContainer>
      <Heading level={2}>Something went wrong</Heading>
      <Text>{errorMessage}</Text>
    </ErrorBoundaryContainer>
  );
}

interface Props {
  children: React.ReactNode;
}

const container = css({
  alignItems: 'center',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  marginX: '8',
  paddingTop: '16',
  textAlign: 'center',
});

function ErrorBoundaryContainer(props: Props) {
  return (
    <div className={container}>
      <Brand size="xl" />
      {props.children}
      <Link to={Routes.Index}>Go back to the home page</Link>
      <Form action={Routes.Logout} method="post">
        <Button variant="link">Or click here to logout</Button>
      </Form>
    </div>
  );
}
