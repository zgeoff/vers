import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import { captureException } from '@sentry/react';
import { Brand, Heading, OTPField, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { Form, Link as RRLink, data, redirect, useSearchParams } from 'react-router';
import { HoneypotInputs } from 'remix-utils/honeypot/react';
import invariant from 'tiny-invariant';
import { z } from 'zod';
import { FormErrorList } from '../../components/form-error-list/form-error-list';
import { RouteErrorBoundary } from '../../components/route-error-boundary';
import { VerifyOTPMutation } from '../../data/mutations/verify-otp';
import { VerificationType } from '../../gql/graphql';
import { useIsFormPending } from '../../hooks/use-is-form-pending';
import { authSessionStorage } from '../../session/auth-session-storage.server';
import type { SessionKey } from '../../session/verify-session-storage.server';
import { verifySessionStorage } from '../../session/verify-session-storage.server';
import { Routes } from '../../types';
import { checkHoneypot } from '../../utils/check-honeypot.server';
import { handleGQLError } from '../../utils/handle-gql-error';
import { isMutationError } from '../../utils/is-mutation-error';
import { toKeylessProps } from '../../utils/to-keyless-props';
import { withErrorHandling } from '../../utils/with-error-handling';
import type { Route } from './+types/route';
import { handleVerification } from './handle-verification.server';
import { QueryParam } from './types';

const VerificationTypeSchema = z.nativeEnum(VerificationType);

export const VerifyOTPFormSchema = z.object({
  [QueryParam.Code]: z.string().length(6, 'Invalid code'),
  [QueryParam.RedirectTo]: z.string().optional(),
  [QueryParam.Target]: z.string().min(1),
  [QueryParam.Type]: VerificationTypeSchema,
});

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    {
      description: '',
      title: 'vers | Verify OTP',
    },
  ];
}

export const loader = withErrorHandling((args: Route.LoaderArgs) => {
  const url = new URL(args.request.url);

  const typeParam = url.searchParams.get(QueryParam.Type);
  const typeParsedWithZod = VerificationTypeSchema.safeParse(typeParam);

  if (!typeParsedWithZod.success) {
    const error = new Error(`Invalid verification type: ${typeParam}`);

    captureException(error);

    return redirect(Routes.Index);
  }

  return {};
});

const transactionIDKeys: Record<VerificationType, SessionKey> = {
  [VerificationType.ChangeEmail]: 'changeEmail#transactionID',
  [VerificationType.ChangeEmailConfirmation]: 'changeEmailConfirm#transactionID',
  [VerificationType.ChangePassword]: 'changePassword#transactionID',
  [VerificationType.Onboarding]: 'onboarding#transactionID',
  [VerificationType.ResetPassword]: 'resetPassword#transactionID',
  [VerificationType.TwoFactorAuth]: 'login2FA#transactionID',
  [VerificationType.TwoFactorAuthDisable]: 'disable2FA#transactionID',
  [VerificationType.TwoFactorAuthSetup]: 'enable2FA#transactionID',
} as const;

export const action = withErrorHandling(async (args: Route.ActionArgs) => {
  const formData = await args.request.formData();

  await checkHoneypot(formData);

  const submission = parseWithZod(formData, { schema: VerifyOTPFormSchema });

  if (submission.status !== 'success') {
    const result = submission.reply();
    const status = submission.status === 'error' ? 400 : 200;

    return data({ result }, { status });
  }

  const verifySession = await verifySessionStorage.getSession(args.request.headers.get('cookie'));

  const authSession = await authSessionStorage.getSession(args.request.headers.get('cookie'));

  const transactionID = verifySession.get(transactionIDKeys[submission.value.type]);

  const sessionID = verifySession.get('login2FA#sessionID') ?? authSession.get('sessionID');

  // if we don't have a transaction ID then we really shouldn't be here.
  if (!transactionID) {
    const result = submission.reply({
      formErrors: ['Something went wrong.'],
    });

    return data({ result }, { status: 400 });
  }

  const result = await args.context.client.mutation(VerifyOTPMutation, {
    input: {
      code: submission.value.code,
      ...(sessionID !== undefined && { sessionID }),
      target: submission.value.target,
      transactionID,
      type: submission.value.type,
    },
  });

  if (result.error) {
    handleGQLError(result.error);

    const formResult = submission.reply({
      formErrors: ['Something went wrong'],
    });

    return data({ result: formResult }, { status: 500 });
  }

  invariant(result.data, 'if no error, there must be data');

  if (isMutationError(result.data.verifyOTP)) {
    const formResult = submission.reply({
      formErrors: [result.data.verifyOTP.error.message],
    });

    return data({ result: formResult }, { status: 400 });
  }

  return await handleVerification(submission.value.type, {
    body: formData,
    client: args.context.client,
    request: args.request,
    submission,
    transactionToken: result.data.verifyOTP.transactionToken,
  });
});

const HEADING_BY_TYPE: Record<VerificationType, string> = {
  [VerificationType.ChangeEmail]: 'Two-factor authentication',
  [VerificationType.ChangeEmailConfirmation]: 'Check your email',
  [VerificationType.ChangePassword]: 'Two-factor authentication',
  [VerificationType.Onboarding]: 'Check your email',
  [VerificationType.ResetPassword]: 'Check your email',
  [VerificationType.TwoFactorAuth]: 'Two-factor authentication',
  [VerificationType.TwoFactorAuthDisable]: 'Two-factor authentication',
  [VerificationType.TwoFactorAuthSetup]: 'Two-factor authentication',
};

const INSTRUCTION_BY_TYPE: Record<VerificationType, string> = {
  [VerificationType.ChangeEmail]:
    'To start changing your email address, please enter your six digit code from your authenticator app',
  [VerificationType.ChangeEmailConfirmation]:
    "To confirm your new email address, please enter the six avatar code we've sent to your email",
  [VerificationType.ChangePassword]:
    'To start changing your password, please enter your six digit code from your authenticator app',
  [VerificationType.Onboarding]:
    "To complete your account creation, please enter the six avatar code we've sent to your email",
  [VerificationType.ResetPassword]:
    "To reset your password, please enter the six avatar code we've sent to your email",
  [VerificationType.TwoFactorAuth]:
    'To log in, please enter the six digit code from your authenticator app',
  [VerificationType.TwoFactorAuthDisable]:
    'To disable two-factor authentication, please enter your six digit code from your authenticator app',
  [VerificationType.TwoFactorAuthSetup]:
    'To enable two-factor authentication, please enter your six digit code from your authenticator app',
};

const OTP_INPUT_MODE_BY_TYPE: Record<VerificationType, 'alphanumeric' | 'numeric'> = {
  [VerificationType.ChangeEmail]: 'numeric',
  [VerificationType.ChangeEmailConfirmation]: 'alphanumeric',
  [VerificationType.ChangePassword]: 'numeric',
  [VerificationType.Onboarding]: 'alphanumeric',
  [VerificationType.ResetPassword]: 'alphanumeric',
  [VerificationType.TwoFactorAuth]: 'numeric',
  [VerificationType.TwoFactorAuthDisable]: 'numeric',
  [VerificationType.TwoFactorAuthSetup]: 'numeric',
};

const pageInfo = css({
  marginBottom: '8',
  textAlign: 'center',
});

const formStyles = css({
  display: 'flex',
  flexDirection: 'column',
  marginBottom: '6',
  width: '96',
});

const otpField = css({
  marginBottom: '6',
});

export function VerifyOTPRoute(props: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const isFormPending = useIsFormPending();

  const typeParsedWithZod = VerificationTypeSchema.safeParse(searchParams.get(QueryParam.Type));

  const type = typeParsedWithZod.success ? typeParsedWithZod.data : null;

  const [form, fields] = useForm({
    constraint: getZodConstraint(VerifyOTPFormSchema),
    defaultValue: {
      [QueryParam.Code]: searchParams.get(QueryParam.Code),
      [QueryParam.RedirectTo]: searchParams.get(QueryParam.RedirectTo),
      [QueryParam.Target]: searchParams.get(QueryParam.Target),
      [QueryParam.Type]: type,
    },
    id: 'verify-otp-form',
    lastResult: props.actionData?.result,
    onValidate(opts) {
      return parseWithZod(opts.formData, { schema: VerifyOTPFormSchema });
    },
  });

  const submitButtonStatus = isFormPending ? StatusButton.Status.Pending : StatusButton.Status.Idle;

  // if a user gets here without a type, there's an issue, but rather than throwing
  // an error, just show them a (useless) generic verification form
  const headingText = type ? HEADING_BY_TYPE[type] : 'Verify your code';
  const instructionText = type ? INSTRUCTION_BY_TYPE[type] : 'Please enter your verification code';

  const otpInputMode = type ? OTP_INPUT_MODE_BY_TYPE[type] : 'numeric';

  return (
    <>
      <section className={pageInfo}>
        <RRLink to={Routes.Index}>
          <Brand size="xl" />
        </RRLink>
        <Heading level={2}>{headingText}</Heading>
        <Text>{instructionText}</Text>
      </section>
      <Form method="POST" {...getFormProps(form)} className={formStyles}>
        <HoneypotInputs />
        <OTPField
          className={otpField}
          errors={fields[QueryParam.Code].errors ?? []}
          inputProps={{
            ...toKeylessProps(getInputProps(fields[QueryParam.Code], { type: 'text' })),
            autoComplete: 'one-time-code',
            autoFocus: true,
            mode: otpInputMode,
          }}
        />
        <input {...getInputProps(fields[QueryParam.Type], { type: 'hidden' })} />
        <input {...getInputProps(fields[QueryParam.Target], { type: 'hidden' })} />
        <input {...getInputProps(fields[QueryParam.RedirectTo], { type: 'hidden' })} />
        <StatusButton
          disabled={isFormPending}
          status={submitButtonStatus}
          type="submit"
          variant="primary"
          fullWidth
        >
          Verify
        </StatusButton>
        <FormErrorList errors={form.errors ?? []} id={form.errorId} />
      </Form>
    </>
  );
}

export function ErrorBoundary() {
  return <RouteErrorBoundary />;
}

export default VerifyOTPRoute;
