import { readQARecords } from './read-qa-records';

interface WriteQARecordInput {
  readonly key: string;
  readonly maxRecords: number;
  readonly record: unknown;
  readonly storage: Storage;
}

export function writeQARecord(input: Readonly<WriteQARecordInput>): void {
  const records = [...readQARecords(input.storage, input.key), input.record].slice(
    -input.maxRecords,
  );

  input.storage.setItem(input.key, JSON.stringify(records));
}
