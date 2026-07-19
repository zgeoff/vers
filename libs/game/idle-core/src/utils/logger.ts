const isDebugEnabled = false;

export const logger = {
  debug: (message: string) => {
    if (isDebugEnabled) {
      console.log(message);
    }
  },
  info: (message: string) => {
    console.log(message);
  },
};
