// Footnotes as written in Markdown (GitHub, Obsidian, markdown-it-footnote): a reference is
// `[^label]` (label without whitespace) and its definition is a line `[^label]: text`, which
// may continue on indented lines. Definitions are file-local. Pure: no vscode.

import { buildFenceMask, isMasked, FenceMask, Interval } from './fenceMask';

const FOOTNOTE_REF_RE = /\[\^[^\s[\]]+\]/g;
// indent, token, label, first-line text
const DEF_RE = /^( {0,3})(\[\^([^\s[\]]+)\]):[ \t]?(.*)$/;
const CONTINUATION_INDENT_RE = /^( {4}|\t)/;
// Lines that end a paragraph's lazy continuation in CommonMark: heading, fence, another
// definition (checked separately), blockquote, list item, thematic break, HTML block.
const BLOCK_START_RE = /^ {0,3}(#{1,6}\s|```|~~~|>|[-*+]\s|\d{1,9}[.)]\s|([-*_]\s*){3,}$|<)/;

// A `[^label]` token in the source: `range` is its offset span, both ends inclusive for
// "is the cursor on it" checks (a hover over either bracket counts).
export type FootnoteToken = { label: string; range: Interval };
export type FootnoteRef = FootnoteToken;
// A definition: its `[^label]` token, the line it starts on, and its assembled text.
export type FootnoteDef = FootnoteToken & { line: number; text: string };

// Remove every footnote reference from a line of text and tidy the whitespace it leaves
// behind, so "Setup[^1]" and "A [^a] and B" read as "Setup" and "A and B".
export function stripFootnoteRefs(text: string): string {
  if (!text.includes('[^')) return text;
  return text
    .replace(FOOTNOTE_REF_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// label → definition (the last one wins when a label is defined twice, as markdown-it-footnote
// renders it). `mask` may be shared by a caller that also locates tokens in the same text.
export function extractFootnoteDefs(
  text: string,
  mask: FenceMask = buildFenceMask(text),
): Map<string, FootnoteDef> {
  const out = new Map<string, FootnoteDef>();
  for (const def of scanDefs(text, mask)) out.set(def.label, def);
  return out;
}

// The definition whose `[^label]` token contains `offset`. Only the token counts: the rest of
// the definition line may hold links that belong to other providers.
export function footnoteDefAt(
  text: string,
  offset: number,
  mask: FenceMask = buildFenceMask(text),
): FootnoteDef | undefined {
  for (const def of scanDefs(text, mask)) {
    if (offset < def.range.start) return undefined;
    if (offset <= def.range.end) return def;
  }
  return undefined;
}

// The reference whose `[^label]` token contains `offset`. A definition's own label is not a
// reference.
export function footnoteRefAt(
  text: string,
  offset: number,
  mask: FenceMask = buildFenceMask(text),
): FootnoteRef | undefined {
  for (const ref of scanRefs(text, mask)) {
    if (offset < ref.range.start) return undefined;
    if (offset <= ref.range.end) return ref;
  }
  return undefined;
}

// Every reference to `label` in document order, excluding the definition's own label.
export function footnoteRefsFor(
  text: string,
  label: string,
  mask: FenceMask = buildFenceMask(text),
): FootnoteRef[] {
  const out: FootnoteRef[] = [];
  for (const ref of scanRefs(text, mask)) if (ref.label === label) out.push(ref);
  return out;
}

// Every `[^label]` reference token outside code, in document order — the one definition of
// "what is a reference", shared by hover, go-to-definition, and find-references.
function* scanRefs(text: string, mask: FenceMask): Generator<FootnoteRef> {
  for (const m of text.matchAll(FOOTNOTE_REF_RE)) {
    const start = m.index;
    const end = start + m[0].length;
    if (isMasked(mask, start) || isDefinitionLabel(text, start, end)) continue;
    yield { label: m[0].slice(2, -1), range: { start, end } };
  }
}

// Every definition outside code, in document order (duplicates included), with its text: the
// rest of the definition line plus its continuation — indented lines (dedented), blank lines
// between indented paragraphs, and, directly after the first line before any blank,
// unindented "lazy" lines, as CommonMark paragraphs allow.
function* scanDefs(text: string, mask: FenceMask): Generator<FootnoteDef> {
  // Split on "\n" only: the mask holds raw-text offsets, and a CRLF file would otherwise drift
  // one character per line. A trailing "\r" is trimmed off with the rest of the line end.
  const lines = text.split('\n');
  let offset = 0;
  for (let i = 0; i < lines.length; i++) {
    const lineOffset = offset;
    offset += lines[i].length + 1;
    if (isMasked(mask, lineOffset)) continue;
    const m = DEF_RE.exec(lines[i].trimEnd());
    if (!m) continue;
    const parts = [m[4].trimEnd()];
    let sawBlank = false;
    for (let j = i + 1; j < lines.length; j++) {
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
      if (!sawBlank && !DEF_RE.test(l.trimEnd()) && !BLOCK_START_RE.test(l)) {
        parts.push(l.trimEnd());
        continue;
      }
      break;
    }
    while (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
    const start = lineOffset + m[1].length;
    yield {
      label: m[3],
      line: i,
      text: parts.join('\n'),
      range: { start, end: start + m[2].length },
    };
  }
}

function isDefinitionLabel(text: string, start: number, end: number): boolean {
  if (text[end] !== ':') return false;
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  return /^ {0,3}$/.test(text.slice(lineStart, start));
}
