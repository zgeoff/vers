import './index.css';
import '../src/styled-system/styles.css';
import type { GlobalProvider } from '@ladle/react';
import { Heading } from '../src/components/heading/heading';

/*
 * Ladle detects this file's exports by walking its AST for `export const`
 * declarations — `export function` (and re-export lists) crash the detection
 * and the app then boots without a StorySourceHeader export. Everything here
 * must stay in `export const … =` form.
 */

export const Provider = (props: Parameters<GlobalProvider>[0]) => (
  <>
    <Heading level={1}>{props.globalState.story}</Heading>
    {props.children}
  </>
);

export const StorySourceHeader = (props: { path: string }) => (
  <div style={{ paddingTop: '2em' }}>
    <code className="ladle-code">{props.path}</code>
  </div>
);
