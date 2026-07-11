import { execa as execa_ } from 'execa';

export const execa = execa_({
  stderr: 'inherit',
  stdout: 'inherit',
});
