import { Heading, Text } from '@vers/design-system';
import invariant from 'tiny-invariant';
import { ContentContainer } from '../../components/content-container';
import { Link } from '../../components/link';
import { RouteErrorBoundary } from '../../components/route-error-boundary';
import { GetAvatarsQuery } from '../../data/queries/get-avatars';
import { Routes } from '../../types';
import { handleGQLError } from '../../utils/handle-gql-error';
import { requireAuth } from '../../utils/require-auth.server';
import { withErrorHandling } from '../../utils/with-error-handling';
import type { Route } from './+types/route';
import * as styles from './route.styles';

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    {
      description: '',
      title: 'vers | Nexus',
    },
  ];
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export const loader = withErrorHandling(async (args: Route.LoaderArgs) => {
  await requireAuth(args.request);

  const result = await args.context.client.query(GetAvatarsQuery, {
    input: {},
  });

  if (result.error) {
    handleGQLError(result.error);

    throw result.error;
  }

  invariant(result.data, 'if no error, there must be data');

  return { avatar: result.data.getAvatars[0] };
});

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function Nexus(props: Route.ComponentProps) {
  if (!props.loaderData.avatar) {
    return (
      <ContentContainer className={styles.container}>
        <Heading level={1}>Destiny Awaits a Vessel</Heading>
        <Text className={styles.tagline}>What is an Arbiter without a champion?</Text>
        <Text>Call forth your Avatar and guide their path across the Aether.</Text>
        <Link className={styles.link} to={Routes.AvatarCreate}>
          Awaken your Avatar
        </Link>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer className={styles.container}>
      <Heading level={2}>Nexus</Heading>
      <Text>vers is a work in progress. Check back often for updates.</Text>
    </ContentContainer>
  );
}

export function ErrorBoundary() {
  return <RouteErrorBoundary />;
}

export default Nexus;
