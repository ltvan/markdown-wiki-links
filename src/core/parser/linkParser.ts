import { buildFenceMask, isMasked, FenceMask } from '../fenceMask';
import { ParsedRef } from '../types';

// Fragment and display text treat a paired [..] as plain text (one nesting level), the way
// regular Markdown link text accepts balanced brackets: [[note#Edge cases [brackets]]].
const LINK_RE =
  /(?<!!)\[\[(?<target>[^[\]|#\r\n]*)(?:#(?<fragment>(?:[^[\]|\r\n]|\[[^[\]|\r\n]*\])+))?(?:\|(?<display>(?:[^[\]\r\n]|\[[^[\]\r\n]*\])+))?\]\]/g;

// `mask` may be supplied by callers that also run parseEmbeds on the same text, so the fence
// mask is built once per document rather than once per parser.
export function parseLinks(text: string, mask: FenceMask = buildFenceMask(text)): ParsedRef[] {
  const refs: ParsedRef[] = [];
  for (const m of text.matchAll(LINK_RE)) {
    const start = m.index ?? 0;
    if (isMasked(mask, start)) continue;
    const g = m.groups as { target: string; fragment?: string; display?: string };
    refs.push({
      kind: 'link',
      target: g.target.trim(),
      fragment: g.fragment?.trim(),
      display: g.display?.trim(),
      range: { start, end: start + m[0].length },
    });
  }
  return refs;
}
