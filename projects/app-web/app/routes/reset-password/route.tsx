import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import { Brand, Field, Heading, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { Form, Link as RRLink, data, redirect } from 'react-router';
import { HoneypotInputs } from 'remix-utils/honeypot/react';
import { z } from 'zod';
import { FormErrorList } from '~/components/form-error-list/form-error-list';
import { Link } from '~/components/link';
import { RouteErrorBoundary } from '~/components/route-error-boundary';
import { FinishPasswordResetMutation } from '~/data/mutations/finish-password-reset';
import { useIsFormPending } from '~/hooks/use-is-form-pending';
import { verifySessionStorage } from '~/session/verify-session-storage.server';
import { Routes } from '~/types';
import { checkHoneypot } from '~/utils/check-honeypot.server';
import { handleGQLError } from '~/utils/handle-gql-error';
import { isMutationError } from '~/utils/is-mutation-error';
import { requireAnonymous } from '~/utils/require-anonymous.server';
import { toKeylessProps } from '~/utils/to-keyless-props';
import { withErrorHandling } from '~/utils/with-error-handling';
import { ConfirmPasswordSchema } from '~/validation/confirm-password-schema';
import type { Route } from './+types/route';

const ResetPasswordFormSchema = z.intersection(
  z.object({
    email: z.string(),
  }),
  ConfirmPasswordSchema,
);

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    {
      description: '',
      title: 'vers | Reset Password',
    },
  ];
}

export const loader = withErrorHandling(async (args: Route.LoaderArgs) => {
  await requireAnonymous(args.request);

  const url = new URL(args.request.url);

  const resetToken = url.searchParams.get('token');
  const email = url.searchParams.get('email');

  if (!resetToken || !email) {
    return redirect(Routes.Login);
  }

  return { email };
});

export const action = withErrorHandling(async (args: Route.ActionArgs) => {
  await requireAnonymous(args.request);

  const url = new URL(args.request.url);

  const resetToken = url.searchParams.get('token');
  const email = url.searchParams.get('email');

  if (!resetToken || !email) {
    return redirect(Routes.Login);
  }

  const formData = await args.request.formData();

  await checkHoneypot(formData);

  const submission = parseWithZod(formData, {
    schema: ResetPasswordFormSchema,
  });

  if (submission.status !== 'success') {
    const result = submission.reply();
    const status = submission.status === 'error' ? 400 : 200;

    return data({ result }, { status });
  }

  const verifySession = await verifySessionStorage.getSession(args.request.headers.get('cookie'));

  // attach our transaction token incase 2FA was required for this reset
  const transactionToken = verifySession.get('resetPassword#transactionToken');

  const result = await args.context.client.mutation(FinishPasswordResetMutation, {
    input: {
      email,
      password: submission.value.password,
      resetToken,
      ...(transactionToken !== undefined && { transactionToken }),
    },
  });

  if (result.error) {
    handleGQLError(result.error);

    const formResult = submission.reply({
      formErrors: ['Something went wrong'],
    });

    return data({ result: formResult }, { status: 500 });
  }

  if (isMutationError(result.data?.finishPasswordReset)) {
    const formResult = submission.reply({
      formErrors: [result.data.finishPasswordReset.error.message],
    });

    return data({ result: formResult }, { status: 400 });
  }

  // clean up our session data
  verifySession.unset('resetPassword#transactionToken');

  // Clear the verification session since we're done with it
  return redirect(Routes.Login, {
    headers: {
      'set-cookie': await verifySessionStorage.commitSession(verifySession),
    },
  });
});

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

export function ResetPassword(props: Route.ComponentProps) {
  const isFormPending = useIsFormPending();

  const [form, fields] = useForm({
    constraint: getZodConstraint(ResetPasswordFormSchema),
    defaultValue: {
      email: props.loaderData.email,
    },
    id: 'reset-password-form',
    lastResult: props.actionData?.result,
    onValidate(opts) {
      return parseWithZod(opts.formData, { schema: ResetPasswordFormSchema });
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
        <Heading level={2}>Reset your password</Heading>
        <Text>Please enter your new password</Text>
      </section>
      <Form method="POST" {...getFormProps(form)} className={formStyles}>
        <HoneypotInputs />
        <input {...getInputProps(fields.email, { type: 'hidden' })} />
        <Field
          errors={fields.password.errors ?? []}
          inputProps={{
            ...toKeylessProps(getInputProps(fields.password, { type: 'password' })),
            autoComplete: 'new-password',
            placeholder: '********',
          }}
          labelProps={{ children: 'New Password' }}
        />
        <Field
          errors={fields.confirmPassword.errors ?? []}
          inputProps={{
            ...toKeylessProps(getInputProps(fields.confirmPassword, { type: 'password' })),
            autoComplete: 'new-password',
            placeholder: '********',
          }}
          labelProps={{ children: 'Confirm Password' }}
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

export default ResetPassword;
