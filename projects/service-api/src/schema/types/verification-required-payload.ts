import { builder } from '../builder';

interface VerificationRequiredPayloadData {
  transactionID: string;
}

export const VerificationRequiredPayload = builder.objectRef<VerificationRequiredPayloadData>(
  'VerificationRequiredPayload',
);

VerificationRequiredPayload.implement({
  fields: (t) => ({
    transactionID: t.exposeString('transactionID'),
  }),
});
