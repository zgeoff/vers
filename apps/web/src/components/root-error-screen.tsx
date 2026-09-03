import * as Sentry from '@sentry/react';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { Button, Heading, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { useEffect } from 'react';

export function RootErrorScreen(props: ErrorComponentProps) {
  useEffect(() => {
    Sentry.captureException(props.error);
  }, [props.error]);

  const handleRetryClick = () => {
    props.reset();
  };

  return (
    <div
      className={css({
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '4',
        justifyContent: 'center',
        minHeight: '[100vh]',
      })}
    >
      <Heading level={1}>Something went wrong</Heading>
      <Text>An unexpected error interrupted this page.</Text>
      <Button onClick={handleRetryClick}>Try again</Button>
    </div>
  );
}
