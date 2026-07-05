import { HttpResponse, graphql } from 'msw';
import type {
  GetEnable2FaVerificationQueryVariables,
  TwoFactorVerification,
} from '../../../gql/graphql';
import { db } from '../../db';
import { decodeMockJWT } from '../../utils/decode-mock-jwt';

type GetEnable2FAVerificationVariables = GetEnable2FaVerificationQueryVariables;

interface GetEnable2FAVerificationResponse {
  getEnable2FAVerification: TwoFactorVerification;
}

export const GetEnable2FAVerification = graphql.query<
  GetEnable2FAVerificationResponse,
  GetEnable2FAVerificationVariables
>('GetEnable2FAVerification', (opts) => {
  const authHeader = opts.request.headers.get('authorization');

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
  if (!authHeader) {
    return HttpResponse.json({
      errors: [{ message: 'Unauthorized' }],
    });
  }

  const token = authHeader.replace('Bearer ', '');
  const payload = decodeMockJWT(token);

  const user = db.user.findFirst({
    where: { id: { equals: payload.sub } },
  });

  if (!user) {
    return HttpResponse.json({
      errors: [{ message: 'Internal Server Error' }],
    });
  }

  const verification = db.verification.findFirst({
    where: {
      target: { equals: user.email },
      type: { equals: '2fa-setup' },
    },
  });

  if (!verification) {
    return HttpResponse.json({
      errors: [{ message: 'Internal Server Error' }],
    });
  }

  const otpURI = `otpauth://totp/vers:${user.email}?secret=JBSWY3DPEHPK3PXP&issuer=vers`;

  return HttpResponse.json({
    data: {
      getEnable2FAVerification: {
        otpURI,
      },
    },
  });
});
