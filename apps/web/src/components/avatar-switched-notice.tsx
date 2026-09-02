import { Button, Text } from '@vers/design-system';

interface AvatarSwitchedNoticeProps {
  readonly activeAvatarName: string;
  readonly attempts?: number;
  readonly levelUps?: number;
  readonly testID?: string;
}

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
