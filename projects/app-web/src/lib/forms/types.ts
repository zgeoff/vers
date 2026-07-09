import type { SubmissionResult } from '@conform-to/react';
import type { SyntheticEvent } from 'react';

interface FormActionInput {
  readonly data: FormData;
}

/**
 * A form's submit action: a server function's client callable, or a stand-in a test injects in its
 * place. Resolves to the reply of `parseWithZod(...).reply()`, a `Response` the server returned for
 * an out-of-band rejection (a tripped honeypot, an unexpected failure), or `undefined` when the
 * server threw a redirect the browser has already followed.
 */
export type FormAction = (
  input: FormActionInput,
) => Promise<Response | SubmissionResult | undefined>;

/**
 * The subset of Conform's submit context the shared submit handler reads — the assembled
 * `FormData`. Conform passes a wider object; only this field is consumed.
 */
export interface FormSubmitContext {
  readonly formData: FormData;
}

/**
 * What the shared submit hook hands an island to drive a Conform form: the last submission's result
 * for `useForm`'s `lastResult`, the in-flight flag for the submit button, and the submit handler for
 * `useForm`'s `onSubmit`.
 */
export interface FormSubmission {
  readonly isPending: boolean;
  readonly lastResult: SubmissionResult | undefined;
  readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>, context: FormSubmitContext) => void;
}
