import { runCorpus as runCorpusImpl } from './run-corpus';
import { runCorpusCase as runCorpusCaseImpl } from './run-corpus-case';

declare global {
  // a browser bundle built from this module assigns these two globals so an injected page can
  // run the same corpus the Bun side already ran, for a byte-for-byte digest comparison
  var runCorpus: typeof runCorpusImpl;
  var runCorpusCase: typeof runCorpusCaseImpl;
}

globalThis.runCorpus = runCorpusImpl;
globalThis.runCorpusCase = runCorpusCaseImpl;
