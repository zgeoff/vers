import { dirname, join } from 'node:path';
import type { JUnitReport, TestTiming } from './types';

export function collectTestTimings(reports: ReadonlyArray<JUnitReport>): Array<TestTiming> {
  return reports
    .flatMap((report) =>
      parseTestCaseAttributes(report.xml).map((attributes) => ({
        file: join(dirname(report.path), attributes.get('file') ?? ''),
        name: attributes.get('name') ?? '',
        seconds: Number(attributes.get('time') ?? '0'),
      })),
    )
    .toSorted((left, right) => right.seconds - left.seconds);
}

const TEST_CASE_TAG = /<testcase\s(?<attributes>[^>]*)>/gu;
const ATTRIBUTE = /(?<key>[\w-]+)="(?<value>[^"]*)"/gu;

function parseTestCaseAttributes(xml: string): Array<Map<string, string>> {
  return [...xml.matchAll(TEST_CASE_TAG)].map((tag) => {
    const attributes = [...(tag.groups?.['attributes'] ?? '').matchAll(ATTRIBUTE)];

    return new Map(
      attributes.map((attribute) => [
        attribute.groups?.['key'] ?? '',
        parseXMLText(attribute.groups?.['value'] ?? ''),
      ]),
    );
  });
}

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
};

function parseXMLText(text: string): string {
  return text.replaceAll(
    /&(?<name>amp|apos|gt|lt|quot);/gu,
    (entity, name: string) => XML_ENTITIES[name] ?? entity,
  );
}
