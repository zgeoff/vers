import * as React from 'react';
import { Text } from '../text/text';
import { Dialog } from './dialog';

export function Default() {
  const [open, setOpen] = React.useState(true);

  return (
    <Dialog onOpenChange={setOpen} open={open} title="Welcome back">
      <Text>You were away for 6 hours. 42 attempts, 2 level-ups.</Text>
    </Dialog>
  );
}

export function NonDismissible() {
  return (
    <Dialog dismissible={false} open title="Welcome back">
      <Text>Catching up… 12 attempts, 1 level-up so far.</Text>
    </Dialog>
  );
}
