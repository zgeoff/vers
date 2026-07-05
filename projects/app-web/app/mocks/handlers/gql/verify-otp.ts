import { HttpResponse, graphql } from 'msw';
import type { VerifyOtpInput, VerifyOtpPayload } from '~/gql/graphql';
import { db } from '../../db';
import { INVALID_OTP_ERROR } from '../../errors';
import { resolveVerificationType } from './utils/resolve-verification-type';

interface VerifyOTPResponse {
  verifyOTP: VerifyOtpPayload;
}

interface VerifyOTPVariables {
  input: VerifyOtpInput;
}

export const VerifyOTP = graphql.mutation<VerifyOTPResponse, VerifyOTPVariables>(
  'VerifyOTP',
  (opts) => {
    const verification = db.verification.findFirst({
      where: {
        target: { equals: opts.variables.input.target },
        type: { equals: resolveVerificationType(opts.variables.input.type) },
      },
    });

    if (!verification) {
      return HttpResponse.json({
        data: {
          verifyOTP: {
            error: INVALID_OTP_ERROR,
          },
        },
      });
    }

    if (!opts.variables.input.code.startsWith('999')) {
      return HttpResponse.json({
        data: {
          verifyOTP: {
            error: INVALID_OTP_ERROR,
          },
        },
      });
    }

    const is2FA = verification.type === '2fa' || verification.type === '2fa-setup';

    if (!is2FA) {
      db.verification.delete({
        where: {
          id: { equals: verification.id },
        },
      });
    }

    return HttpResponse.json({
      data: {
        verifyOTP: {
          transactionToken: 'valid_transaction_token',
        },
      },
    });
  },
);
