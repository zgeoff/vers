import { parse } from '@conform-to/react';
import type { SubmissionResult } from '@conform-to/react';
import type { SyntheticEvent } from 'react';
import { useState } from 'react';
import type { FormAction, FormSubmission, FormSubmitContext } from './types';

/**
 * The message shown for a submission the server rejected out of band — a tripped honeypot or an
 * unexpected failure — where no field-level detail is safe to reflect back.
 */
const GENERIC_SUBMIT_ERROR = 'Something went wrong. Please try again.';

/**
 * Wires a Conform form to a TanStack Start server function: dispatches the assembled `FormData`,
 * holds the reply as `lastResult`, and tracks the in-flight flag. Triages the three shapes a
 * server-function call resolves to — a redirect the browser already followed (`undefined`, nothing
 * left to show), a `Response` the server returned for an out-of-band rejection (mapped to a
 * form-level error), or a `SubmissionResult` from `reply()` (shown as-is).
 *
 * The optional `lastResult` seeds the form before any dispatch: a fabricated result renders its
 * error→UI mapping with no server round-trip, and a real dispatch's reply supersedes it. A live
 * dispatch never resolves to a plain result under bun test — an uncompiled server-function call
 * relays only a `Response` or a thrown redirect — so branch coverage comes from the seed and from an
 * injected `action`, not from the real wire.
 */
export function useFormSubmit(action: FormAction, lastResult?: SubmissionResult): FormSubmission {
  const [dispatchedResult, setDispatchedResult] = useState<SubmissionResult | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);

  const send = async (formData: FormData): Promise<void> => {
    setIsPending(true);

    try {
      const result = await action({ data: formData });

      if (result === undefined) {
        return;
      }

      // A result Conform re-applies mid-session must carry the submitted values as `initialValue`,
      // or its update path reads the absence as a reset and drops the error. A raw `Response` has
      // none, so rebuild one through `parse` over the same `FormData`.
      const nextResult =
        result instanceof Response
          ? parse(formData, { resolve: () => ({ error: { '': [GENERIC_SUBMIT_ERROR] } }) }).reply()
          : result;

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
