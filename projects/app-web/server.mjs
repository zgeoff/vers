import * as fs from 'node:fs';
import sourceMapSupport from 'source-map-support';

sourceMapSupport.install({
  retrieveSourceMap(source) {
    // get source file without the `file://` prefix or `?t=...` suffix
    // oxlint-disable-next-line typescript/prefer-regexp-exec -- baseline(#236)
    const match = source.match(/^file:\/\/(?<sourcePath>.*)\?t=[.\d]+$/);

    if (match) {
      return {
        map: fs.readFileSync(`${match[1]}.map`, 'utf8'),
        url: source,
      };
    }
    return null;
  },
});

await (process.env.NODE_ENV === 'production'
  ? import('./build/server/index.js')
  : import('./server/index.ts'));
