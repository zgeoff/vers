import { data, Form, redirect, Link as RRLink } from 'react-router';
import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import { Brand, Field, Heading, StatusButton, Text } from '@vers/design-system';
import { css } from '@vers/styled-system/css';
import { UserEmailSchema } from '@vers/validation';
import { HoneypotInputs } from 'remix-utils/honeypot/react';
import invariant from 'tiny-invariant';
import { z } from 'zod';
import { FormErrorList } from '~/components/form-error-list/form-error-list';
import { Link } from '~/components/link';
import { RouteErrorBoundary } from '~/components/route-error-boundary';
import { StartEmailSignupMutation } from '~/data/mutations/start-email-signup';
import { VerificationType } from '~/gql/graphql';
import { useIsFormPending } from '~/hooks/use-is-form-pending';
import { verifySessionStorage } from '~/session/verify-session-storage.server';
import { Routes } from '~/types';
import { checkHoneypot } from '~/utils/check-honeypot.server';
import { handleGQLError } from '~/utils/handle-gql-error';
import { isMutationError } from '~/utils/is-mutation-error';
import { omitKeyProp } from '~/utils/omit-key-prop';
import { requireAnonymous } from '~/utils/require-anonymous.server';
import { withErrorHandling } from '~/utils/with-error-handling';
import type { Route } from './+types/route';
import { QueryParam } from '../verify-otp/types';

const SignupFormSchema = z.object({
  email: UserEmailSchema,
});

export const meta: Route.MetaFunction = () => [
  {
    description: '',
    title: 'vers | Signup',
  },
];

export const loader = withErrorHandling(async (args: Route.LoaderArgs) => {
  await requireAnonymous(args.request);

  return {};
});

export const action = withErrorHandling(async (args: Route.ActionArgs) => {
  await requireAnonymous(args.request);

  const formData = await args.request.formData();

  await checkHoneypot(formData);

  const submission = parseWithZod(formData, { schema: SignupFormSchema });

  if (submission.status !== 'success') {
    const result = submission.reply();
    const status = submission.status === 'error' ? 400 : 200;

    return data({ result }, { status });
  }

  const result = await args.context.client.mutation(StartEmailSignupMutation, {
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

  invariant(result.data, 'if no error, there should be data');

  if (isMutationError(result.data.startEmailSignup)) {
    const formResult = submission.reply({
      formErrors: [result.data.startEmailSignup.error.message],
    });

    return data({ result: formResult }, { status: 400 });
  }

  const verifySession = await verifySessionStorage.getSession(
    args.request.headers.get('cookie'),
  );

  verifySession.set(
    'onboarding#transactionID',
    result.data.startEmailSignup.transactionID,
  );

  const searchParams = new URLSearchParams({
    [QueryParam.Target]: submission.value.email,
    [QueryParam.Type]: VerificationType.Onboarding,
  });

  return redirect(`${Routes.VerifyOTP}?${searchParams.toString()}`, {
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
  marginBottom: '6',
  width: '96',
});

export function Signup(props: Route.ComponentProps) {
  const isFormPending = useIsFormPending();

  const [form, fields] = useForm({
    constraint: getZodConstraint(SignupFormSchema),
    id: 'signup-form',
    lastResult: props.actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: SignupFormSchema });
    },
    shouldRevalidate: 'onBlur',
  });

  const submitButtonStatus = isFormPending
    ? StatusButton.Status.Pending
    : StatusButton.Status.Idle;

  return (
    <>
      <section className={pageInfo}>
        <RRLink to={Routes.Index}>
          <Brand />
        </RRLink>
        <Heading level={2}>Create an account</Heading>
        <Text>Please enter your details to create an account</Text>
      </section>

      <Form method="POST" {...getFormProps(form)} className={formStyles}>
        <HoneypotInputs />
        <Field
          errors={fields.email.errors ?? []}
          inputProps={{
            ...omitKeyProp(getInputProps(fields.email, { type: 'email' })),
            autoComplete: 'email',
            autoFocus: true,
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
          Signup
        </StatusButton>
      </Form>
      <Text>Already have an account?</Text>
      <Link to={Routes.Login}>Login</Link>
    </>
  );
}

export function ErrorBoundary() {
  return <RouteErrorBoundary />;
}

export default Signup;
