import '../src/styled-system/styles.css';
import type { GlobalProvider } from '@ladle/react';
import { Heading } from '../src/components/heading/heading';

export function Provider(props: Parameters<GlobalProvider>[0]) {
  return (
    <>
      <Heading level={1}>{props.globalState.story}</Heading>
      {props.children}
    </>
  );
}
