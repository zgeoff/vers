import type { ErrorComponentProps } from '@tanstack/react-router';
import { useRouter } from '@tanstack/react-router';
import { Button, Heading, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { RootErrorScreen } from '../../components/root-error-screen';
import { runIgnoringRejection } from '../../lib/idle/run-ignoring-rejection';
import { NetworkFailureError } from '../../lib/offline/network-failure-error';

export function GameErrorScreen(props: ErrorComponentProps) {
  const router = useRouter();

  if (!(props.error instanceof NetworkFailureError)) {
    return <RootErrorScreen {...props} />;
  }

  const handleRetryClick = () => {
    runIgnoringRejection(router.invalidate());
  };

  return (
    <main
      className={css({
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '4',
        justifyContent: 'center',
        minHeight: '[100vh]',
        padding: '6',
        textAlign: 'center',
      })}
    >
      <Heading level={1}>You are offline</Heading>
      <Text>
        This screen needs the network to open. Your game keeps playing, and it saves its progress
        when the connection returns.
      </Text>
      <Button onClick={handleRetryClick}>Try again</Button>
    </main>
  );
}
