import { classes } from '@vers/data';
import { Spinner } from '@vers/design-system';
import {
  AetherNode,
  createInitializeMessage,
  createSetActivityMessage,
  useActivity,
  useSimulationInitialized,
  useSimulationWorker,
} from '@vers/idle-client';
import { EquipmentSlot } from '@vers/idle-core';
import { useEffect } from 'react';
import { redirect } from 'react-router';
import invariant from 'tiny-invariant';
import { ContentContainer } from '../../components/content-container';
import { GetAvatarsQuery } from '../../data/queries/get-avatars';
import { resolveClassFromGQLEnum } from '../../data/utils/resolve-class-from-gql-enum';
import { activityData } from '../../dummy-data';
import { Routes } from '../../types';
import { handleGQLError } from '../../utils/handle-gql-error';
import { requireAuth } from '../../utils/require-auth.server';
import { withErrorHandling } from '../../utils/with-error-handling';
import type { Route } from './+types/route';

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

  const classID = resolveClassFromGQLEnum(avatar.class);

  return {
    activity: activityData,
    avatar: {
      ...avatar,
      class: classID,
      image: classes[classID].images.unitFrame,
      life: 100,
      paperdoll: {
        [EquipmentSlot.MainHand]: {
          id: '1',
          maxDamage: 10,
          minDamage: 1,
          name: 'Test Item',
          speed: 1,
        },
      },
    },
  };
});

export function AetherNodeRoute(props: Route.ComponentProps) {
  const worker = useSimulationWorker();
  const initialized = useSimulationInitialized();
  const activity = useActivity();

  useEffect(() => {
    if (!worker) {
      return;
    }

    if (!initialized) {
      const message = createInitializeMessage();

      worker.port.postMessage(message);
    }

    if (initialized) {
      const message = createSetActivityMessage(props.loaderData.activity, props.loaderData.avatar);

      worker.port.postMessage(message);
    }
  }, [worker, initialized, props.loaderData.activity, props.loaderData.avatar]);

  if (!activity || activity.id !== props.loaderData.activity.id) {
    return (
      <ContentContainer>
        <Spinner />
      </ContentContainer>
    );
  }

  return (
    <ContentContainer>
      <AetherNode />
    </ContentContainer>
  );
}

export default AetherNodeRoute;
