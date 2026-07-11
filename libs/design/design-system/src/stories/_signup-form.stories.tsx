import { getFormProps, getInputProps, useForm } from '@conform-to/react';
import { getZodConstraint, parseWithZod } from '@conform-to/zod/v4';
import { z } from 'zod';
import { Button } from '../components/button/button';
import { CheckboxField } from '../components/checkbox-field/checkbox-field';
import { Field } from '../components/field/field';

const SignupFormSchema = z.object({
  agreeToTerms: z
    .literal('on', {
      error: 'You must agree to the terms of service and privacy policy',
    })
    .transform(Boolean),
  confirmPassword: z.string().min(6),
  email: z.email(),
  name: z.string().min(2),
  password: z.string().min(6),
  rememberMe: z.boolean().optional(),
  username: z.string().min(4),
});

export function Default() {
  const [form, fields] = useForm({
    constraint: getZodConstraint(SignupFormSchema),
    id: 'signup-form',
    onValidate(options) {
      return parseWithZod(options.formData, { schema: SignupFormSchema });
    },
    shouldRevalidate: 'onBlur',
  });

  const { key: _nameKey, ...nameInputProps } = getInputProps(fields.name, {
    type: 'text',
  });

  const { key: _emailKey, ...emailInputProps } = getInputProps(fields.email, {
    type: 'email',
  });

  const { key: _usernameKey, ...usernameInputProps } = getInputProps(fields.username, {
    type: 'text',
  });

  const { key: _passwordKey, ...passwordInputProps } = getInputProps(fields.password, {
    type: 'password',
  });

  const { key: _confirmPasswordKey, ...confirmPasswordInputProps } = getInputProps(
    fields.confirmPassword,
    { type: 'password' },
  );

  const { key: _rememberMeKey, ...rememberMeInputProps } = getInputProps(fields.rememberMe, {
    type: 'checkbox',
  });

  const { key: _agreeToTermsKey, ...agreeToTermsInputProps } = getInputProps(fields.agreeToTerms, {
    type: 'checkbox',
  });

  return (
    <form {...getFormProps(form)}>
      <Field
        errors={fields.name.errors ?? []}
        inputProps={{
          ...nameInputProps,
          placeholder: 'John Smith',
        }}
        labelProps={{
          children: 'Name',
        }}
      />
      <Field
        errors={fields.email.errors ?? []}
        inputProps={{
          ...emailInputProps,
          placeholder: 'your.email@example.com',
        }}
        labelProps={{
          children: 'Email',
        }}
      />
      <Field
        errors={fields.username.errors ?? []}
        inputProps={{
          ...usernameInputProps,
          placeholder: 'johnsmith_123',
        }}
        labelProps={{
          children: 'Username',
        }}
      />
      <Field
        errors={fields.password.errors ?? []}
        inputProps={{
          ...passwordInputProps,
          placeholder: 'Enter your password',
        }}
        labelProps={{
          children: 'Password',
        }}
      />
      <Field
        errors={fields.confirmPassword.errors ?? []}
        inputProps={{
          ...confirmPasswordInputProps,
          placeholder: 'Confirm your password',
        }}
        labelProps={{
          children: 'Confirm password',
        }}
      />
      <CheckboxField
        checkboxProps={{
          ...rememberMeInputProps,
        }}
        errors={fields.rememberMe.errors ?? []}
        labelProps={{ children: 'Remember me' }}
      />
      <CheckboxField
        checkboxProps={{
          ...agreeToTermsInputProps,
        }}
        errors={fields.agreeToTerms.errors ?? []}
        labelProps={{ children: 'Agree to terms and services' }}
      />
      <Button type="submit">Submit</Button>
    </form>
  );
}
