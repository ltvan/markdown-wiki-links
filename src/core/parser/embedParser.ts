import { buildFenceMask, isMasked, FenceMask } from '../fenceMask';
import { ParsedRef } from '../types';

// The fragment accepts a paired [..] as plain text (one nesting level), mirroring linkParser.
const EMBED_RE =
  /!\[\[(?<target>[^[\]|#\r\n]+)(?:#(?<fragment>(?:[^[\]|\r\n]|\[[^[\]|\r\n]*\])+))?(?:\|(?<sizeHint>[^[\]\r\n]+))?\]\]/g;

// `mask` may be supplied by callers that also run parseLinks on the same text, so the fence
// mask is built once per document rather than once per parser.
export function parseEmbeds(text: string, mask: FenceMask = buildFenceMask(text)): ParsedRef[] {
  const refs: ParsedRef[] = [];
  for (const m of text.matchAll(EMBED_RE)) {
    const start = m.index ?? 0;
    if (isMasked(mask, start)) continue;
    const g = m.groups as { target: string; fragment?: string; sizeHint?: string };
    refs.push({
      kind: 'embed',
      target: g.target.trim(),
      fragment: g.fragment?.trim(),
      sizeHint: g.sizeHint?.trim(),
      range: { start, end: start + m[0].length },
    });
  }
  return refs;
}
