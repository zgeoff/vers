import type { AppLoadContext } from 'react-router';

interface DataFnArgs {
  context: AppLoadContext;
  params: Record<string, string | undefined>;
  request: Request;
}

type DataFn<Args extends DataFnArgs, Data> = (args: Args) => Promise<Data>;

type DataFnWrapper<Args extends DataFnArgs, Data> = (
  fn: DataFn<Args, Data>,
) => DataFn<Args, Data> | Promise<DataFn<Args, Data>>;

/**
 * Compose a react-router data function with a series of wrappers.
 *
 * Cleans up our test code by allowing us to chain multiple wrappers
 * without filling our setup code with imperative conditionals.
 *
 * Supports conditionally applying wrappers by passing a falsy value in
 * it's place e.g.
 *
 * composeDataFnWrappers(
 *   dataFn,
 *   isThing && wrapperFn(...),
 * );
 *
 * @param dataFn - The data function to wrap.
 * @param wrapperFns - The wrapper functions to apply.
 * @returns A new data function that is the composition of the input data function and the wrapper functions.
 */
export function composeDataFnWrappers<Args extends DataFnArgs, Data>(
  dataFn: DataFn<Args, Data>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
  ...wrapperFns: Array<DataFnWrapper<Args, Data> | false | undefined>
) {
  return async (args: Args): Promise<Data> => {
    const [firstWrapperFn, ...restWrapperFns] = wrapperFns;

    // if we don't want to apply any wrappers, immediately return the result
    // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
    if (!firstWrapperFn && restWrapperFns.length === 0) {
      return dataFn(args);
    }

    // if we don't want to apply our first wrapper, set our result to our initial data fn
    // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
    let result = firstWrapperFn ? await firstWrapperFn(dataFn) : dataFn;

    // apply our remaining wrappers
    for (const nextWrapperFn of restWrapperFns) {
      // oxlint-disable-next-line typescript/strict-boolean-expressions -- baseline(#236)
      if (nextWrapperFn) {
        result = await nextWrapperFn(result);
      }
    }

    return result(args);
  };
}
