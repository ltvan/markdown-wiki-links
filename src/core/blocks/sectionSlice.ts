import { Heading } from '../types';

import { extractHeadings, slugify } from './headingExtractor';
import { extractBlockIds } from './blockIdExtractor';

// A heading fragment matches by exact (footnote-free) text or by slug, so [[note#Setup]] and
// [[note#setup]] both reach "## Setup[^1]".
function findHeading(fragment: string, headings: Heading[]): Heading | undefined {
  const slug = slugify(fragment);
  return headings.find((h) => h.text === fragment || h.slug === slug);
}

export function lineForFragment(fragment: string, text: string): number | undefined {
  if (fragment.startsWith('^')) return extractBlockIds(text).get(fragment.slice(1))?.line;
  return findHeading(fragment, extractHeadings(text))?.line;
}

export function sliceSection(fragment: string, text: string): string {
  const lines = text.split(/\r?\n/);
  if (fragment.startsWith('^')) {
    const at = extractBlockIds(text).get(fragment.slice(1));
    if (!at) return '';
    let end = at.line;
    while (end + 1 < lines.length && lines[end + 1].trim() !== '') end++;
    return lines.slice(at.line, end + 1).join('\n');
  }
  const headings = extractHeadings(text);
  const h = findHeading(fragment, headings);
  if (!h) return '';
  const next = headings.find((x) => x.line > h.line);
  return lines.slice(h.line, next?.line ?? lines.length).join('\n');
}
