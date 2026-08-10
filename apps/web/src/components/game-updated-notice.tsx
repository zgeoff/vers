import { Button, Text } from '@vers/design-system';

interface GameUpdatedNoticeProps {
  readonly testID?: string;
}

/**
 * Explains a start rejected because the running build's engine no longer supports the current
 * content, offering the one remedy that fetches a build that does — a reload. Deliberately a
 * button rather than an automatic reload: a stale service worker or CDN cache can still serve the
 * very bundle that failed, and an unconditional reload would loop.
 */
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
