import type { AvatarData } from '@vers/service-types';
import invariant from 'tiny-invariant';
import { builder } from '../builder';
import { AvatarClass } from './avatar-class';
import { User } from './user';

export const Avatar = builder.objectRef<AvatarData>('Avatar');

Avatar.implement({
  fields: (t) => ({
    class: t.expose('class', { type: AvatarClass }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    id: t.exposeID('id'),
    level: t.exposeInt('level'),
    name: t.exposeString('name'),
    user: t.field({
      resolve: async (parent, _args, ctx) => {
        const user = await ctx.services.user.getUser.query({
          id: parent.userID,
        });

        invariant(user, 'user must exist for session to be created');

        return user;
      },
      type: User,
    }),
    xp: t.exposeInt('xp'),
  }),
});
