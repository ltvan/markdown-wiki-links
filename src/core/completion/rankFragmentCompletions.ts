import { extractHeadings } from '../blocks/headingExtractor';
import { extractBlockIds } from '../blocks/blockIdExtractor';
import { Heading } from '../types';

export type FragmentCandidate = {
  label: string;
  insertText: string;
  kind: 'heading' | 'block-id';
  // 1-indexed line number — exposed for human-facing display ("line 12").
  line: number;
  // 1..6 for headings; undefined for block-ids.
  level?: number;
};

// Returns headings and block IDs interleaved in document order — the order they appear in
// the target file is what the user is scanning when they pick a fragment.
export function rankFragmentCompletions(targetText: string): FragmentCandidate[] {
  const headings: FragmentCandidate[] = extractHeadings(targetText).map((h) => ({
    label: h.text,
    insertText: fragmentFor(h),
    kind: 'heading',
    line: h.line + 1,
    level: h.level,
  }));
  const blocks: FragmentCandidate[] = [...extractBlockIds(targetText)].map(([id, info]) => ({
    label: `^${id}`,
    insertText: `^${id}`,
    kind: 'block-id',
    line: info.line + 1,
  }));
  return [...headings, ...blocks].sort((a, b) => a.line - b.line);
}

// A paired [..] is plain text inside [[...]], but "|" starts display text and an unpaired or
// nested bracket cannot be written in a link — those headings are inserted as their slug,
// which the resolver matches too.
const LINK_SAFE_RE = /^(?:[^[\]|]|\[[^[\]|]*\])*$/;

function fragmentFor(h: Heading): string {
  return LINK_SAFE_RE.test(h.text) ? h.text : h.slug;
}
