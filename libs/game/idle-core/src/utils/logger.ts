const isDebugEnabled = false;

export const logger = {
  debug: (buildMessage: () => string) => {
    if (isDebugEnabled) {
      console.log(buildMessage());
    }
  },
  info: (message: string) => {
    console.log(message);
  },
};
