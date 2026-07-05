import { builder } from '../builder';

interface MutationErrorData {
  message: string;
  title: string;
}

export const MutationError = builder.objectRef<MutationErrorData>('MutationError');

MutationError.implement({
  fields: (t) => ({
    message: t.exposeString('message'),
    title: t.exposeString('title'),
  }),
});
