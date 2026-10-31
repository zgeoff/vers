import { readQARecords } from './read-qa-records';

interface UpdateQARecordsInput {
  readonly key: string;
  readonly storage: Storage;
  readonly update: (records: ReadonlyArray<unknown>) => ReadonlyArray<unknown>;
}

export function updateQARecords(input: Readonly<UpdateQARecordsInput>): void {
  const records = input.update(readQARecords(input.storage, input.key));

  input.storage.setItem(input.key, JSON.stringify(records));
}
