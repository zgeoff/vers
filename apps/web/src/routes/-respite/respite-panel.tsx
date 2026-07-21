import { isDefinedError } from '@orpc/client';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Heading, Text } from '@vers/design-system';
import { ScreenPanel } from '../../components/screen-panel';
import { findActiveAvatar } from '../../lib/avatar/find-active-avatar';
import type { OrpcQueryUtils } from '../../lib/rpc/orpc';

interface RespitePanelProps {
  readonly orpc: OrpcQueryUtils;
}

export function RespitePanel(props: RespitePanelProps) {
  const query = useQuery(props.orpc.avatar.getAvatars.queryOptions({ input: {} }));

  if (query.isPending) {
    return <Text data-testid="respite-loading">Loading your avatar…</Text>;
  }

  if (query.error) {
    const message = isDefinedError(query.error) ? query.error.message : 'Something went wrong';

    return <Text data-testid="respite-error">{message}</Text>;
  }

  const avatar = findActiveAvatar(query.data);

  // no avatars at all → forge one; avatars but no selection (the active one was deleted, or the
  // cached roster went stale) → the roster, where an existing avatar can be picked
  if (avatar === null && query.data.avatars.length === 0) {
    return (
      <>
        <Heading level={1}>Destiny Awaits a Vessel</Heading>
        <Text>What is an Arbiter without a champion?</Text>
        <Text>Call forth your Avatar and guide their path across the World.</Text>
        <Link to="/avatars/create">Awaken your Avatar</Link>
      </>
    );
  }

  if (avatar === null) {
    return (
      <>
        <Heading level={1}>Destiny Awaits a Vessel</Heading>
        <Text>Your champions await your word.</Text>
        <Link to="/avatars">Choose your Avatar</Link>
      </>
    );
  }

  return (
    <>
      <Heading level={1}>Respite</Heading>
      <Text>Your refuge between expeditions.</Text>
      <ScreenPanel label="Town services — market · stash · sanctum" />
    </>
  );
}
