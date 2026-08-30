import { buildFenceMask, isMasked } from '../fenceMask';
import { stripFootnoteRefs } from '../footnote';
import { Heading } from '../types';

export function extractHeadings(text: string): Heading[] {
  const mask = buildFenceMask(text);
  const lines = text.split(/\r?\n/);
  const out: Heading[] = [];
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    if (!isMasked(mask, offset)) {
      const m = lines[i].match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (m) {
        const text = stripFootnoteRefs(m[2].trim());
        out.push({ text, slug: slugify(text), line: i, level: m[1].length });
      }
    }
    offset += lines[i].length + 1;
  }
  return out;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '');
}
