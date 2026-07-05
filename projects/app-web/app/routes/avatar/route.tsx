import { classes } from '@vers/data';
import { Heading, Text } from '@vers/design-system';
import { redirect } from 'react-router';
import invariant from 'tiny-invariant';
import { ContentContainer } from '~/components/content-container';
import { RouteErrorBoundary } from '~/components/route-error-boundary';
import { GetAvatarsQuery } from '~/data/queries/get-avatars';
import { resolveClassFromGQLEnum } from '~/data/utils/resolve-class-from-gql-enum';
import { Routes } from '~/types';
import { handleGQLError } from '~/utils/handle-gql-error';
import { requireAuth } from '~/utils/require-auth.server';
import { withErrorHandling } from '~/utils/with-error-handling';
import type { Route } from './+types/route';

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    {
      description: '',
      title: 'vers | Avatar',
    },
  ];
}

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

  const [avatar] = result.data.getAvatars;

  if (!avatar) {
    return redirect(Routes.AvatarCreate);
  }

  return {
    avatar: {
      ...avatar,
      class: resolveClassFromGQLEnum(avatar.class),
    },
  };
});

export function Avatar(props: Route.ComponentProps) {
  const { avatar } = props.loaderData;

  return (
    <ContentContainer>
      <Heading level={1}>{avatar.name}</Heading>
      <Text>Level {avatar.level}</Text>
      <Text>{classes[avatar.class].name}</Text>
      <Text>XP: {avatar.xp}</Text>
    </ContentContainer>
  );
}

export function ErrorBoundary() {
  return <RouteErrorBoundary />;
}

export default Avatar;
