import { data, Form, redirect } from 'react-router';
import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import {
  Heading,
  OTPField,
  SingleLineCode,
  StatusButton,
  Text,
} from '@vers/design-system';
import QRCode from 'qrcode';
import invariant from 'tiny-invariant';
import { z } from 'zod';
import { ContentContainer } from '~/components/content-container';
import { FormErrorList } from '~/components/form-error-list/form-error-list';
import { RouteErrorBoundary } from '~/components/route-error-boundary';
import { FinishEnable2FAMutation } from '~/data/mutations/finish-enable-2fa';
import { VerifyOTPMutation } from '~/data/mutations/verify-otp';
import { GetCurrentUserQuery } from '~/data/queries/get-current-user';
import { GetEnable2FAVerificationQuery } from '~/data/queries/get-enable-2fa-verification';
import { VerificationType } from '~/gql/graphql';
import { useIsFormPending } from '~/hooks/use-is-form-pending';
import { verifySessionStorage } from '~/session/verify-session-storage.server';
import { Routes } from '~/types';
import { captureGQLExceptions } from '~/utils/capture-gql-exceptions.server';
import { isMutationError } from '~/utils/is-mutation-error';
import { omitKeyProp } from '~/utils/omit-key-prop';
import { requireAuth } from '~/utils/require-auth.server';
import { withErrorHandling } from '~/utils/with-error-handling';
import type { Route } from './+types/route';
import * as styles from './route.styles';

const VerifyOTPFormSchema = z.object({
  code: z.string().length(6, 'Invalid code'),
  target: z.string().min(1),
});

export const meta: Route.MetaFunction = () => [
  {
    description: '',
    title: 'vers | Verify 2FA',
  },
];

export const loader = withErrorHandling(async (args: Route.LoaderArgs) => {
  await requireAuth(args.request);

  const currentUserResult = await args.context.client.query(
    GetCurrentUserQuery,
    {},
  );

  if (currentUserResult.error) {
    throw currentUserResult.error;
  }

  invariant(currentUserResult.data, 'if no error, there should be data');

  // if we've already got 2FA enabled send us back to the account page
  if (currentUserResult.data.getCurrentUser.is2FAEnabled) {
    return redirect(Routes.Account);
  }

  const twoFactorVerifyResult = await args.context.client.query(
    GetEnable2FAVerificationQuery,
    {},
  );

  if (twoFactorVerifyResult.error) {
    throw twoFactorVerifyResult.error;
  }

  invariant(twoFactorVerifyResult.data, 'if no error, there should be data');

  const qrCode = await QRCode.toDataURL(
    twoFactorVerifyResult.data.getEnable2FAVerification.otpURI,
  );

  return {
    otpURI: twoFactorVerifyResult.data.getEnable2FAVerification.otpURI,
    qrCode,
    target: currentUserResult.data.getCurrentUser.email,
  };
});

export const action = withErrorHandling(async (args: Route.ActionArgs) => {
  const { sessionID } = await requireAuth(args.request);

  const formData = await args.request.formData();

  const submission = parseWithZod(formData, { schema: VerifyOTPFormSchema });

  if (submission.status !== 'success') {
    const result = submission.reply();
    const status = submission.status === 'error' ? 400 : 200;

    return data({ result }, { status });
  }

  const verifySession = await verifySessionStorage.getSession(
    args.request.headers.get('cookie'),
  );

  const transactionID = verifySession.get('enable2FA#transactionID');

  // if we don't have a transaction ID then we really shouldn't be here.
  if (!transactionID) {
    const result = submission.reply({
      formErrors: ['Something went wrong.'],
    });

    return data({ result }, { status: 500 });
  }

  const verifyOTPResult = await args.context.client.mutation(
    VerifyOTPMutation,
    {
      input: {
        code: submission.value.code,
        sessionID,
        target: submission.value.target,
        transactionID,
        type: VerificationType.TwoFactorAuthSetup,
      },
    },
  );

  if (verifyOTPResult.error) {
    captureGQLExceptions(verifyOTPResult.error);

    const result = submission.reply({
      formErrors: ['Something went wrong'],
    });

    return data({ result }, { status: 500 });
  }

  invariant(verifyOTPResult.data, 'if no error, there should be data');

  if (isMutationError(verifyOTPResult.data.verifyOTP)) {
    const result = submission.reply({
      formErrors: [verifyOTPResult.data.verifyOTP.error.message],
    });

    return data({ result }, { status: 400 });
  }

  const finishEnable2FAResult = await args.context.client.mutation(
    FinishEnable2FAMutation,
    {
      input: {
        transactionToken: verifyOTPResult.data.verifyOTP.transactionToken,
      },
    },
  );

  if (finishEnable2FAResult.error) {
    captureGQLExceptions(finishEnable2FAResult.error);

    const result = submission.reply({
      formErrors: ['Something went wrong'],
    });

    return data({ result }, { status: 500 });
  }

  invariant(finishEnable2FAResult.data, 'if no error, there should be data');

  // clean up our session data
  verifySession.unset('enable2FA#transactionID');

  const setCookieHeader =
    await verifySessionStorage.commitSession(verifySession);

  if (isMutationError(finishEnable2FAResult.data.finishEnable2FA)) {
    const result = submission.reply({
      formErrors: [finishEnable2FAResult.data.finishEnable2FA.error.message],
    });

    return data(
      { result },
      { headers: { 'Set-Cookie': setCookieHeader }, status: 400 },
    );
  }

  return redirect(Routes.Account, {
    headers: { 'Set-Cookie': setCookieHeader },
  });
});

export function AccountVerify2FARoute(props: Route.ComponentProps) {
  const isFormPending = useIsFormPending();

  const [form, fields] = useForm({
    constraint: getZodConstraint(VerifyOTPFormSchema),
    defaultValue: {
      target: props.loaderData.target,
    },
    id: 'verify-2fa-form',
    lastResult: props.actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: VerifyOTPFormSchema });
    },
  });

  const submitButtonStatus = isFormPending
    ? StatusButton.Status.Pending
    : StatusButton.Status.Idle;

  return (
    <ContentContainer>
      <div className={styles.container}>
        <Heading level={2}>Setup 2FA</Heading>
        <section className={styles.section}>
          <Text bold>Scan this QR code with your authenticator app.</Text>
          <Text>
            Once you enable 2FA, you will need to enter a code from your
            authenticator app every time you log in or perform important
            actions. Do not lose access to your authenticator app, or you will
            lose access to your account.
          </Text>
          <img
            alt="QR code for 2FA"
            className={styles.qrCode}
            src={props.loaderData.qrCode}
          />
        </section>
        <section className={styles.section}>
          <Text>
            If you cannot scan the QR code, you can manually add this account to
            your authenticator app using this code:
          </Text>
          <SingleLineCode className={styles.otpCode}>
            {props.loaderData.otpURI}
          </SingleLineCode>
        </section>
        <section className={styles.section}>
          <Text>
            Once you have added the account to your authenticator app, enter the
            code from your authenticator app below.
          </Text>
          <Form
            method="POST"
            {...getFormProps(form)}
            className={styles.formStyles}
          >
            <OTPField
              className={styles.otpField}
              errors={fields.code.errors ?? []}
              inputProps={{
                ...omitKeyProp(getInputProps(fields.code, { type: 'text' })),
                autoComplete: 'one-time-code',
                autoFocus: true,
                mode: 'numeric',
              }}
            />
            <input {...getInputProps(fields.target, { type: 'hidden' })} />
            <FormErrorList errors={form.errors ?? []} id={form.errorId} />
            <StatusButton
              status={submitButtonStatus}
              type="submit"
              variant="primary"
            >
              Submit
            </StatusButton>
          </Form>
        </section>
      </div>
    </ContentContainer>
  );
}

export function ErrorBoundary() {
  return <RouteErrorBoundary />;
}

export default AccountVerify2FARoute;
