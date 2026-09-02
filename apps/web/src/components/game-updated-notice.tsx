import { Button, Text } from '@vers/design-system';

interface GameUpdatedNoticeProps {
  readonly testID?: string;
}

// a button, never an automatic reload: a stale service worker or CDN cache can serve the very
// bundle that failed again, and an unconditional reload would loop
export function GameUpdatedNotice(props: Readonly<GameUpdatedNoticeProps>) {
  return (
    <>
      <Text data-testid={props.testID} role="alert">
        The game has been updated — reload to continue.
      </Text>
      <Button
        onClick={() => {
          globalThis.location.reload();
        }}
      >
        Reload
      </Button>
    </>
  );
}
