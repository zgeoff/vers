import type { UserData } from '@vers/service-types';
import { builder } from '../builder';

export const User = builder.objectRef<UserData>('User');

User.implement({
  fields: (t) => ({
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    email: t.exposeString('email'),
    id: t.exposeID('id'),
    is2FAEnabled: t.boolean({
      resolve: async (user, _, ctx) => {
        const verification = await ctx.services.verification.getVerification.query({
          target: user.email,
          type: '2fa',
        });
        return Boolean(verification);
      },
    }),
    name: t.exposeString('name'),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
    username: t.exposeString('username'),
  }),
});
