import { builder } from '../builder';

interface MutationSuccessData {
  success: true;
}

// simple type for when we don't want to return a more complex object from a mutation
export const MutationSuccess = builder.objectRef<MutationSuccessData>('MutationSuccess');

MutationSuccess.implement({
  fields: (t) => ({
    success: t.exposeBoolean('success'),
  }),
});
