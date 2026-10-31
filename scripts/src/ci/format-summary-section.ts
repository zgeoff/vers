interface SummarySection {
  readonly heading: string;
  readonly language: string;
  readonly body: string;
}

export function formatSummarySection(section: Readonly<SummarySection>): string {
  const body = section.body.endsWith('\n') ? section.body : `${section.body}\n`;

  return `## ${section.heading}\n\n\`\`\`${section.language}\n${body}\`\`\`\n`;
}
