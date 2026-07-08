import { isDefinedError } from '@orpc/client';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Heading, Text } from '@vers/design-system';
import type { OrpcQueryUtils } from '../../lib/rpc/orpc';

interface NexusPanelProps {
  readonly orpc: OrpcQueryUtils;
}

/**
 * The nexus HUD's client-lane read: whether the caller has an avatar decides between a call to
 * action for one who doesn't and the (currently placeholder) HUD for one who does. Client lane
 * end to end per the two-lane rule — this is where tick-driven HUD state will land.
 */
export function NexusPanel(props: NexusPanelProps) {
  const query = useQuery(props.orpc.avatar.getAvatars.queryOptions({ input: {}, retry: false }));

  if (query.isPending) {
    return <Text data-testid="nexus-loading">Loading your avatar…</Text>;
  }

  if (query.error) {
    const message = isDefinedError(query.error) ? query.error.message : 'Something went wrong';

    return <Text data-testid="nexus-error">{message}</Text>;
  }

  const [avatar] = query.data;

  if (avatar === undefined) {
    return (
      <>
        <Heading level={1}>Destiny Awaits a Vessel</Heading>
        <Text>What is an Arbiter without a champion?</Text>
        <Text>Call forth your Avatar and guide their path across the Aether.</Text>
        <Link to="/avatar/create">Awaken your Avatar</Link>
      </>
    );
  }

  return (
    <>
      <Heading level={2}>Nexus</Heading>
      <Text>vers is a work in progress. Check back often for updates.</Text>
    </>
  );
}
