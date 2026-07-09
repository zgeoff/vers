import { useForm } from '@tanstack/react-form';
import { mergeForm, useTransform } from '@tanstack/react-form-start';
import { Field, StatusButton, Text } from '@vers/design-system';
import { useState } from 'react';
import { z } from 'zod';

const ReferenceSchema = z.object({
  email: z.email('Enter a valid email'),
  password: z.string().min(8, 'Password is too short'),
});

interface ServerErrors {
  readonly fields?: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly form?: ReadonlyArray<string>;
}

interface FormActionInput {
  readonly data: FormData;
}

export type TFAction = (input: FormActionInput) => Promise<ServerErrors | 'redirect' | Response>;

interface TFReferenceFormProps {
  readonly action?: TFAction;
  readonly serverState?: ServerErrors;
}

const GENERIC_SUBMIT_ERROR = 'Something went wrong. Please try again.';

export function TFReferenceForm(props: Readonly<TFReferenceFormProps>) {
  const action = props.action ?? noopAction;

  const [dispatchedErrors, setDispatchedErrors] = useState<ServerErrors | undefined>(undefined);
  const serverState = dispatchedErrors ?? props.serverState;

  const form = useForm({
    defaultValues: { email: '', password: '' },
    transform: useTransform(
      (baseForm) => mergeForm(baseForm, toFormState(serverState)),
      [serverState],
    ),
    validators: { onSubmit: ReferenceSchema },
    async onSubmit(ctx) {
      const data = new FormData();

      data.set('email', ctx.value.email);
      data.set('password', ctx.value.password);

      const result = await action({ data });

      if (result === 'redirect') {
        return;
      }

      if (result instanceof Response) {
        setDispatchedErrors({ form: [GENERIC_SUBMIT_ERROR] });

        return;
      }

      setDispatchedErrors(result);
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <Field
            errors={field.state.meta.errors.filter((error) => typeof error === 'string')}
            inputProps={{
              name: field.name,
              onBlur: field.handleBlur,
              onChange: (event) => {
                field.handleChange(event.target.value);
              },
              placeholder: 'Email',
              type: 'email',
              value: field.state.value,
            }}
            labelProps={{ children: 'Email', htmlFor: field.name }}
          />
        )}
      </form.Field>
      <form.Field name="password">
        {(field) => (
          <Field
            errors={field.state.meta.errors.filter((error) => typeof error === 'string')}
            inputProps={{
              name: field.name,
              onBlur: field.handleBlur,
              onChange: (event) => {
                field.handleChange(event.target.value);
              },
              placeholder: 'Password',
              type: 'password',
              value: field.state.value,
            }}
            labelProps={{ children: 'Password', htmlFor: field.name }}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => [state.errorMap.onServer, state.isSubmitting] as const}>
        {([serverError, isSubmitting]) => {
          const message = pickFormMessage(serverError);

          return (
            <>
              {message !== undefined && <Text role="alert">{message}</Text>}
              <StatusButton
                disabled={isSubmitting}
                status={isSubmitting ? StatusButton.Status.Pending : StatusButton.Status.Idle}
                type="submit"
                variant="primary"
              >
                Sign in
              </StatusButton>
            </>
          );
        }}
      </form.Subscribe>
    </form>
  );
}

function noopAction(): Promise<'redirect'> {
  return Promise.resolve('redirect');
}

function toFormState(errors: ServerErrors | undefined) {
  if (errors === undefined) {
    return {};
  }

  const fields: Record<string, Array<string>> = {};

  for (const [name, messages] of Object.entries(errors.fields ?? {})) {
    fields[name] = [...messages];
  }

  return { errorMap: { onServer: { fields, form: [...(errors.form ?? [])] } } };
}

/**
 * TanStack Form represents a form-level `onServer` error as a bare `string[]` after a submit but as
 * a `{ form, fields }` object when merged in through `mergeForm` at mount. Reading either shape
 * takes this normalization the library does not do itself.
 */
function pickFormMessage(serverError: unknown): string | undefined {
  if (Array.isArray(serverError)) {
    return serverError.find((error) => typeof error === 'string');
  }

  if (
    serverError !== null &&
    typeof serverError === 'object' &&
    'form' in serverError &&
    Array.isArray(serverError.form)
  ) {
    return serverError.form.find((error) => typeof error === 'string');
  }

  return undefined;
}
