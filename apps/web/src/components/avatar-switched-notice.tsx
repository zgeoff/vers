import { Button, Text } from '@vers/design-system';

interface AvatarSwitchedNoticeProps {
  readonly activeAvatarName: string;
  readonly attempts?: number;
  readonly levelUps?: number;
  readonly testID?: string;
}

/**
 * Explains a start or catch-up rejected because the account's active avatar changed, naming the
 * new one and offering the one remedy that re-runs every gate against it — a reload. Carries
 * `attempts`/`levelUps` tallies when a fallback catch-up already ran for the new avatar before
 * this notice rendered, rendering nothing further while they read zero.
 */
export function AvatarSwitchedNotice(props: Readonly<AvatarSwitchedNoticeProps>) {
  return (
    <>
      <Text data-testid={props.testID} role="alert">
        You’re now playing as <strong>{props.activeAvatarName}</strong>. Reload to continue as{' '}
        {props.activeAvatarName}.
      </Text>
      {props.attempts !== undefined && props.attempts > 0 && (
        <Text>
          While you were away: {props.attempts} attempts, {props.levelUps} level-ups.
        </Text>
      )}
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
