interface ReleaseTrigger {
  readonly kind: 'release';
  readonly pkg: string;
  readonly version: string;
}

interface DateTrigger {
  readonly kind: 'date';
  readonly date: string;
}

export type Trigger = DateTrigger | ReleaseTrigger;
