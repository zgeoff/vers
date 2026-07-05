// TODO(#109): resolve this travesty
const isDebugEnabled = false;

export const logger = {
  // oxlint-disable-next-line typescript/no-confusing-void-expression -- baseline(#236)
  debug: (message: string) => isDebugEnabled && console.log(message),
  // oxlint-disable-next-line typescript/no-confusing-void-expression -- baseline(#236)
  info: (message: string) => console.log(message),
};
