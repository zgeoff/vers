import { parse } from '@conform-to/react';
import type { SubmissionResult } from '@conform-to/react';
import type { SyntheticEvent } from 'react';
import { useState } from 'react';
import type { FormAction, FormSubmission, FormSubmitContext } from './types';

const GENERIC_SUBMIT_ERROR = 'Something went wrong. Please try again.';

export function useFormSubmit(
  action: FormAction,
  lastResult?: SubmissionResult,
  onSuccess?: () => void,
): FormSubmission {
  const [dispatchedResult, setDispatchedResult] = useState<SubmissionResult | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);

  const send = async (formData: FormData): Promise<void> => {
    setIsPending(true);

    try {
      let result: Awaited<ReturnType<FormAction>>;

      try {
        result = await action({ data: formData });
      } catch {
        // the server-function middleware has already reported the fault; the browser's only job
        // is to tell the player the submission failed
        setDispatchedResult(buildGenericErrorResult(formData));

        return;
      }

      if (result === undefined) {
        // the submission already succeeded server-side — a completion callback's failure
        // (an analytics hook, say) must never turn that into a rejected submission
        try {
          onSuccess?.();
        } catch {
          // intentionally swallowed
        }

        return;
      }

      const nextResult = result instanceof Response ? buildGenericErrorResult(formData) : result;

      setDispatchedResult(nextResult);
    } finally {
      setIsPending(false);
    }
  };

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>, context: FormSubmitContext): void => {
    event.preventDefault();
    void send(context.formData);
  };

  return { isPending, lastResult: dispatchedResult ?? lastResult, onSubmit };
}

// A result Conform re-applies mid-session must carry the submitted values as `initialValue`, or
// its update path reads the absence as a reset and drops the error. A raw `Response` or a thrown
// error has none, so rebuild one through `parse` over the same `FormData`.
function buildGenericErrorResult(formData: FormData): SubmissionResult {
  return parse(formData, { resolve: () => ({ error: { '': [GENERIC_SUBMIT_ERROR] } }) }).reply();
}
