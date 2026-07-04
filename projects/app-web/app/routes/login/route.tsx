import {
  data,
  Form,
  redirect,
  Link as RRLink,
  useSearchParams,
} from 'react-router';
import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod';
import {
  Brand,
  CheckboxField,
  Field,
  Heading,
  StatusButton,
  Text,
} from '@vers/design-system';
import { PasswordSchema, UserEmailSchema } from '@vers/validation';
import { HoneypotInputs } from 'remix-utils/honeypot/react';
import { safeRedirect } from 'remix-utils/safe-redirect';
import invariant from 'tiny-invariant';
import { z } from 'zod';
import type { ForceLogoutPayload, TwoFactorLoginPayload } from '~/gql/graphql';
import { FormErrorList } from '~/components/form-error-list/form-error-list';
import { Link } from '~/components/link';
import { RouteErrorBoundary } from '~/components/route-error-boundary';
import { LoginWithPasswordMutation } from '~/data/mutations/login-with-password';
import { VerificationType } from '~/gql/graphql';
import { useIsFormPending } from '~/hooks/use-is-form-pending';
import { authSessionStorage } from '~/session/auth-session-storage.server';
import { verifySessionStorage } from '~/session/verify-session-storage.server';
import { Routes } from '~/types';
import { checkHoneypot } from '~/utils/check-honeypot.server';
import { handleGQLError } from '~/utils/handle-gql-error';
import { isMutationError } from '~/utils/is-mutation-error';
import { requireAnonymous } from '~/utils/require-anonymous.server';
import { withErrorHandling } from '~/utils/with-error-handling';
import { FormBooleanSchema } from '~/validation/form-boolean-schema';
import type { Route } from './+types/route';
import { QueryParam } from '../verify-otp/types';
import * as styles from './route.styles';

const LoginFormSchema = z.object({
  email: UserEmailSchema,
  password: PasswordSchema,
  redirect: z.string().optional(),
  rememberMe: FormBooleanSchema.default('off'),
});

export const meta: Route.MetaFunction = () => [
  {
    description: '',
    title: 'vers | Login',
  },
];

export const loader = withErrorHandling(async (args: Route.LoaderArgs) => {
  await requireAnonymous(args.request);
});

export const action = withErrorHandling(async (args: Route.ActionArgs) => {
  await requireAnonymous(args.request);

  const formData = await args.request.formData();

  await checkHoneypot(formData);

  const submission = parseWithZod(formData, { schema: LoginFormSchema });

  if (submission.status !== 'success') {
    const result = submission.reply();
    const status = submission.status === 'error' ? 400 : 200;

    return data({ result }, { status });
  }

  const result = await args.context.client.mutation(LoginWithPasswordMutation, {
    input: {
      email: submission.value.email,
      password: submission.value.password,
      rememberMe: submission.value.rememberMe,
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

  if (isMutationError(result.data.loginWithPassword)) {
    const formResult = submission.reply({
      formErrors: [result.data.loginWithPassword.error.message],
    });

    return data({ result: formResult }, { status: 400 });
  }

  // if we need to 2FA login, set our session as needed then redirect
  if (is2FALoginPayload(result.data.loginWithPassword)) {
    const verifySession = await verifySessionStorage.getSession(
      args.request.headers.get('cookie'),
    );

    verifySession.set(
      'login2FA#sessionID',
      result.data.loginWithPassword.sessionID,
    );

    verifySession.set(
      'login2FA#transactionID',
      result.data.loginWithPassword.transactionID,
    );

    const searchParams = new URLSearchParams({
      [QueryParam.Target]: submission.value.email,
      [QueryParam.Type]: VerificationType.TwoFactorAuth,
    });

    if (submission.value.redirect) {
      searchParams.set(QueryParam.RedirectTo, submission.value.redirect);
    }

    return redirect(`${Routes.VerifyOTP}?${searchParams.toString()}`, {
      headers: {
        'set-cookie': await verifySessionStorage.commitSession(verifySession),
      },
    });
  }

  // if we need to force logout, set our session as needed then redirect
  if (isForceLogoutPayload(result.data.loginWithPassword)) {
    const verifySession = await verifySessionStorage.getSession(
      args.request.headers.get('cookie'),
    );

    verifySession.set('loginLogout#email', submission.value.email);
    verifySession.set(
      'loginLogout#transactionToken',
      result.data.loginWithPassword.transactionToken,
    );

    return redirect(Routes.LoginForceLogout, {
      headers: {
        'set-cookie': await verifySessionStorage.commitSession(verifySession),
      },
    });
  }

  // if we're here, we've received our tokens and we can set the auth session
  const authSession = await authSessionStorage.getSession(
    args.request.headers.get('cookie'),
  );

  authSession.set('sessionID', result.data.loginWithPassword.session.id);
  authSession.set('accessToken', result.data.loginWithPassword.accessToken);
  authSession.set('refreshToken', result.data.loginWithPassword.refreshToken);

  return redirect(safeRedirect(submission.value.redirect ?? Routes.Nexus), {
    headers: {
      'set-cookie': await authSessionStorage.commitSession(authSession, {
        expires: new Date(result.data.loginWithPassword.session.expiresAt),
      }),
    },
  });
});

function is2FALoginPayload(
  payload: object | TwoFactorLoginPayload,
): payload is TwoFactorLoginPayload {
  return 'transactionID' in payload;
}

function isForceLogoutPayload(
  payload: ForceLogoutPayload | object,
): payload is ForceLogoutPayload {
  return 'transactionToken' in payload;
}

export function Login(props: Route.ComponentProps) {
  const [searchParams] = useSearchParams();
  const isFormPending = useIsFormPending();

  const [form, fields] = useForm({
    constraint: getZodConstraint(LoginFormSchema),
    defaultValue: {
      redirect: searchParams.get('redirect'),
    },
    id: 'login-form',
    lastResult: props.actionData?.result,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: LoginFormSchema });
    },
    shouldRevalidate: 'onBlur',
  });

  const submitButtonStatus = isFormPending
    ? StatusButton.Status.Pending
    : StatusButton.Status.Idle;

  return (
    <>
      <section className={styles.pageInfo}>
        <RRLink to={Routes.Index}>
          <Brand size="xl" />
        </RRLink>
        <Heading level={2}>Welcome back</Heading>
        <Text>Please enter your details to login</Text>
      </section>
      <Form method="POST" {...getFormProps(form)} className={styles.formStyles}>
        <HoneypotInputs />
        <Field
          errors={fields.email.errors ?? []}
          inputProps={{
            ...getInputProps(fields.email, { type: 'email' }),
            autoComplete: 'email',
            placeholder: 'your.email@example.com',
          }}
          labelProps={{ children: 'Email' }}
        />
        <Field
          errors={fields.password.errors ?? []}
          inputProps={{
            ...getInputProps(fields.password, { type: 'password' }),
            autoComplete: 'current-password',
            placeholder: '********',
          }}
          labelProps={{ children: 'Password' }}
        />
        <input {...getInputProps(fields.redirect, { type: 'hidden' })} />
        <CheckboxField
          checkboxProps={getInputProps(fields.rememberMe, { type: 'checkbox' })}
          errors={fields.rememberMe.errors ?? []}
          labelProps={{ children: 'Remember me' }}
        />
        <FormErrorList errors={form.errors ?? []} id={form.errorId} />
        <StatusButton
          className={styles.submitButton}
          disabled={isFormPending}
          status={submitButtonStatus}
          type="submit"
          variant="primary"
          fullWidth
        >
          Login
        </StatusButton>
        <Link className={styles.forgotPasswordLink} to={Routes.ForgotPassword}>
          Forgot your password?
        </Link>
      </Form>
      <Text>Don&apos;t have an account?</Text>
      <Link to={Routes.Signup}>Signup</Link>
    </>
  );
}

export function ErrorBoundary() {
  return <RouteErrorBoundary />;
}

export default Login;
