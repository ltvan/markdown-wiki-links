// Footnotes as written in Markdown (GitHub, Obsidian, markdown-it-footnote): a reference is
// `[^label]` (label without whitespace) and its definition is a line `[^label]: text`, which
// may continue on indented lines. Definitions are file-local. Pure: no vscode.

import { buildFenceMask, isMasked, FenceMask } from './fenceMask';

const FOOTNOTE_REF_RE = /\[\^[^\s[\]]+\]/g;
const DEF_RE = /^ {0,3}\[\^([^\s[\]]+)\]:[ \t]?(.*)$/;
const CONTINUATION_INDENT_RE = /^( {4}|\t)/;
// Lines that end a paragraph's lazy continuation in CommonMark: heading, fence, another
// definition (checked separately), blockquote, list item, thematic break, HTML block.
const BLOCK_START_RE = /^ {0,3}(#{1,6}\s|```|~~~|>|[-*+]\s|\d{1,9}[.)]\s|([-*_]\s*){3,}$|<)/;

export type FootnoteDef = { line: number; text: string };
export type FootnoteRef = { label: string; range: { start: number; end: number } };

// Remove every footnote reference from a line of text and tidy the whitespace it leaves
// behind, so "Setup[^1]" and "A [^a] and B" read as "Setup" and "A and B".
export function stripFootnoteRefs(text: string): string {
  if (!text.includes('[^')) return text;
  return text
    .replace(FOOTNOTE_REF_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// label → definition. The text is the rest of the definition line plus its continuation:
// indented lines (dedented), blank lines between indented paragraphs, and — directly after
// the first line, before any blank — unindented "lazy" lines, as CommonMark paragraphs allow.
// `mask` may be shared by a caller that also runs footnoteRefAt on the same text.
export function extractFootnoteDefs(
  text: string,
  mask: FenceMask = buildFenceMask(text),
): Map<string, FootnoteDef> {
  // Split on "\n" only: the mask holds raw-text offsets, and a CRLF file would otherwise drift
  // one character per line. A trailing "\r" is trimmed off with the rest of the line end.
  const lines = text.split('\n');
  const out = new Map<string, FootnoteDef>();
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineOffset = offset;
    offset += lines[i].length + 1;
    if (isMasked(mask, lineOffset)) continue;
    const m = DEF_RE.exec(lines[i].trimEnd());
    if (!m) continue;
    const parts = [m[2].trimEnd()];
    let sawBlank = false;
    const isDef = (l: string): boolean => DEF_RE.test(l.trimEnd());
    let j = i + 1;
    for (; j < lines.length; j++) {
      const l = lines[j];
      if (l.trim() === '') {
        sawBlank = true;
        parts.push('');
        continue;
      }
      if (CONTINUATION_INDENT_RE.test(l)) {
        parts.push(l.replace(CONTINUATION_INDENT_RE, '').trimEnd());
        sawBlank = false;
        continue;
      }
      if (!sawBlank && !isDef(l) && !BLOCK_START_RE.test(l)) {
        parts.push(l.trimEnd());
        continue;
      }
      break;
    }
    while (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
    out.set(m[1], { line: i, text: parts.join('\n') });
  }
  return out;
}

// The footnote reference whose `[^label]` span contains `offset` (both ends inclusive, like a
// hover over either bracket). A definition's own `[^label]:` is not a reference.
export function footnoteRefAt(
  text: string,
  offset: number,
  mask: FenceMask = buildFenceMask(text),
): FootnoteRef | undefined {
  for (const m of text.matchAll(FOOTNOTE_REF_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (offset < start) return undefined;
    if (offset > end || isMasked(mask, start)) continue;
    if (isDefinitionLabel(text, start, end)) continue;
    return { label: m[0].slice(2, -1), range: { start, end } };
  }
  return undefined;
}

function isDefinitionLabel(text: string, start: number, end: number): boolean {
  if (text[end] !== ':') return false;
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  return /^ {0,3}$/.test(text.slice(lineStart, start));
}
