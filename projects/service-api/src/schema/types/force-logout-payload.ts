import { builder } from '../builder';

interface ForceLogoutPayloadData {
  sessionID: string;
  transactionToken: string;
}

export const ForceLogoutPayload = builder.objectRef<ForceLogoutPayloadData>('ForceLogoutPayload');

ForceLogoutPayload.implement({
  fields: (t) => ({
    sessionID: t.exposeString('sessionID'),
    transactionToken: t.exposeString('transactionToken'),
  }),
});
