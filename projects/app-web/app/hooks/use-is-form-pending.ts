import { useFormAction, useNavigation } from 'react-router';

interface IsFormPendingOptions {
  formAction?: string;
  formMethod?: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
}

const defaultOptions: IsFormPendingOptions = {
  formMethod: 'POST',
};

// returns true if the current navigation is submitting the current route's form.
//
// defaults to the current route's form action via POST.
//
// the default `formAction` will include query params, but `navigation.formAction`
// will not, so don't use the default `formAction` if you want to know if a form is
// submitting without specific query params.
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
export function useIsFormPending(options: IsFormPendingOptions = {}) {
  const finalOptions = { ...defaultOptions, ...options };

  const contextualFormAction = useFormAction();
  const navigation = useNavigation();

  const isPendingState = navigation.state !== 'idle';
  const isFormMethod = navigation.formMethod === finalOptions.formMethod;
  const isFormAction = navigation.formAction === (finalOptions.formAction ?? contextualFormAction);

  return isPendingState && isFormAction && isFormMethod;
}
