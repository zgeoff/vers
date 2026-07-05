import { Box } from '@vers/styled-system/jsx';
import { Button } from './button';

export function Default() {
  return (
    <>
      <Row>
        <Button size="sm" variant="default">
          Default
        </Button>
        <Button size="sm" variant="primary">
          Primary
        </Button>
        <Button size="sm" variant="secondary">
          Secondary
        </Button>
        <Button size="sm" variant="tertiary">
          Tertiary
        </Button>
        <Button size="sm" variant="link">
          Link
        </Button>
      </Row>
      <Row>
        <Button size="md" variant="default">
          Default
        </Button>
        <Button size="md" variant="primary">
          Primary
        </Button>
        <Button size="md" variant="secondary">
          Secondary
        </Button>
        <Button size="md" variant="tertiary">
          Tertiary
        </Button>
        <Button size="md" variant="link">
          Link
        </Button>
      </Row>
      <Row>
        <Button size="lg" variant="default">
          Default
        </Button>
        <Button size="lg" variant="primary">
          Primary
        </Button>
        <Button size="lg" variant="secondary">
          Secondary
        </Button>
        <Button size="lg" variant="tertiary">
          Tertiary
        </Button>
        <Button size="lg" variant="link">
          Link
        </Button>
      </Row>
      <Row>
        <Button size="md" variant="default" disabled>
          Default
        </Button>
        <Button size="md" variant="primary" disabled>
          Primary
        </Button>
        <Button size="md" variant="secondary" disabled>
          Secondary
        </Button>
        <Button size="md" variant="tertiary" disabled>
          Tertiary
        </Button>
        <Button size="md" variant="link" disabled>
          Link
        </Button>
      </Row>
    </>
  );
}

interface RowProps {
  children: React.ReactNode;
}

// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- baseline(#236)
function Row(props: RowProps) {
  return (
    <Box display="flex" flexDirection="row" gap="2">
      {props.children}
    </Box>
  );
}
