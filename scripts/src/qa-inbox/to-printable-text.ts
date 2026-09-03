interface PrintableOptions {
  readonly keepLineBreaks?: boolean;
}

// every C0 and C1 control character except the line breaks and tabs the caller decides on
const CONTROL_PATTERN = /(?![\n\r\t])\p{Cc}/gu;
const LINE_BREAK_PATTERN = /[\n\r\t]+/g;

export function toPrintableText(value: string, options: PrintableOptions = {}): string {
  const stripped = value.replaceAll(CONTROL_PATTERN, '');

  return options.keepLineBreaks === true ? stripped : stripped.replaceAll(LINE_BREAK_PATTERN, ' ');
}
