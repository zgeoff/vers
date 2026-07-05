import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import { Brand, Field, Heading, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { UserEmailSchema } from '@vers/validation';
import { Form, Link as RRLink, data, redirect } from 'react-router';
import { HoneypotInputs } from 'remix-utils/honeypot/react';
import invariant from 'tiny-invariant';
import { z } from 'zod';
import { FormErrorList } from '~/components/form-error-list/form-error-list';
import { Link } from '~/components/link';
import { RouteErrorBoundary } from '~/components/route-error-boundary';
import { StartPasswordResetMutation } from '~/data/mutations/start-password-reset';
import { useIsFormPending } from '~/hooks/use-is-form-pending';
import { verifySessionStorage } from '~/session/verify-session-storage.server';
import { Routes } from '~/types';
import { checkHoneypot } from '~/utils/check-honeypot.server';
import { handleGQLError } from '~/utils/handle-gql-error';
import { isMutationError } from '~/utils/is-mutation-error';
import { isVerificationRequiredPayload } from '~/utils/is-verification-required-payload';
import { requireAnonymous } from '~/utils/require-anonymous.server';
import { toKeylessProps } from '~/utils/to-keyless-props';
import { withErrorHandling } from '~/utils/with-error-handling';
import type { Route } from './+types/route';

const ForgotPasswordFormSchema = z.object({
  email: UserEmailSchema,
});

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    {
      description: '',
      title: 'vers | Forgot Password',
    },
  ];
}

export const loader = withErrorHandling(async (args: Route.LoaderArgs) => {
  await requireAnonymous(args.request);

  return null;
});

export const action = withErrorHandling(async (args: Route.ActionArgs) => {
  await requireAnonymous(args.request);

  const formData = await args.request.formData();

  await checkHoneypot(formData);

  const submission = parseWithZod(formData, {
    schema: ForgotPasswordFormSchema,
  });

  if (submission.status !== 'success') {
    const result = submission.reply();
    const status = submission.status === 'error' ? 400 : 200;

    return data({ result }, { status });
  }

  const result = await args.context.client.mutation(StartPasswordResetMutation, {
    input: {
      email: submission.value.email,
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

  if (isMutationError(result.data.startPasswordReset)) {
    const formResult = submission.reply({
      formErrors: [result.data.startPasswordReset.error.message],
    });

    return data({ result: formResult }, { status: 400 });
  }

  if (isVerificationRequiredPayload(result.data.startPasswordReset)) {
    const verifySession = await verifySessionStorage.getSession(args.request.headers.get('cookie'));

    verifySession.set('resetPassword#transactionID', result.data.startPasswordReset.transactionID);

    return redirect(Routes.ResetPasswordStarted, {
      headers: {
        'set-cookie': await verifySessionStorage.commitSession(verifySession),
      },
    });
  }

  return redirect(Routes.ResetPasswordStarted);
});

const pageInfo = css({
  marginBottom: '8',
  textAlign: 'center',
});

const formStyles = css({
  marginBottom: '6',
  width: '96',
});

export function ForgotPassword(props: Route.ComponentProps) {
  const isFormPending = useIsFormPending();

  const [form, fields] = useForm({
    constraint: getZodConstraint(ForgotPasswordFormSchema),
    id: 'forgot-password-form',
    lastResult: props.actionData?.result,
    onValidate(opts) {
      return parseWithZod(opts.formData, { schema: ForgotPasswordFormSchema });
    },
    shouldRevalidate: 'onBlur',
  });

  const submitButtonStatus = isFormPending ? StatusButton.Status.Pending : StatusButton.Status.Idle;

  return (
    <>
      <section className={pageInfo}>
        <RRLink to={Routes.Index}>
          <Brand size="xl" />
        </RRLink>
        <Heading level={2}>Forgot your password?</Heading>
        <Text>No worries, we&apos;ll send you reset instructions to your email address.</Text>
      </section>

      <Form method="POST" {...getFormProps(form)} className={formStyles}>
        <HoneypotInputs />
        <Field
          errors={fields.email.errors ?? []}
          inputProps={{
            ...toKeylessProps(getInputProps(fields.email, { type: 'email' })),
            autoComplete: 'email',
            placeholder: 'your.email@example.com',
          }}
          labelProps={{ children: 'Email' }}
        />
        <FormErrorList errors={form.errors ?? []} id={form.errorId} />
        <StatusButton
          disabled={isFormPending}
          status={submitButtonStatus}
          type="submit"
          variant="primary"
          fullWidth
        >
          Reset Password
        </StatusButton>
      </Form>
      <Text>Remember your password?</Text>
      <Link to={Routes.Login}>Login</Link>
    </>
  );
}

export function ErrorBoundary() {
  return <RouteErrorBoundary />;
}

export default ForgotPassword;
