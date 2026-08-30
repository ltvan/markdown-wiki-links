export type ParsedRef = {
  kind: 'link' | 'embed';
  target: string;
  fragment?: string;
  display?: string;
  sizeHint?: string;
  range: { start: number; end: number };
};

// `text`/`slug` are footnote-free: what links match and what completion offers.
export type Heading = { text: string; slug: string; line: number; level: number };
export type BlockId = { id: string; line: number; kind: 'suffix' | 'standalone' };
export type IndexEntry = { fsPath: string; relPath: string; baseNoExt: string };
export type ResolvedTarget = { fsPath: string; line?: number };
