import type { SubmissionResult } from '@conform-to/react';
import type { SyntheticEvent } from 'react';

interface FormActionInput {
  readonly data: FormData;
}

export type FormAction = (
  input: FormActionInput,
) => Promise<Response | SubmissionResult | undefined>;

export interface FormSubmitContext {
  readonly formData: FormData;
}

export interface FormSubmission {
  readonly isPending: boolean;
  readonly lastResult: SubmissionResult | undefined;
  readonly onSubmit: (event: SyntheticEvent<HTMLFormElement>, context: FormSubmitContext) => void;
}
