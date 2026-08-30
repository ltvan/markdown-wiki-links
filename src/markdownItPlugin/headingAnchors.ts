import type MarkdownIt from 'markdown-it';

// The heading ids VSCode's Markdown preview assigns, reproduced from markdown-language-features
// (verified against the bundle in .vscode-test, 1.121–1.135): the heading's plain text — only
// text, emoji, and code_inline tokens count — is trimmed, lowercased, stripped of everything
// outside the github-slugger character class (see DROPPED_RE), and every remaining whitespace
// character becomes "-";
// duplicates get -1, -2, …. Which inline tokens exist depends on the plugins loaded into the
// shared markdown-it instance — a footnote plugin turns "[^1]" into a text-less footnote_ref —
// so anchors are computed with the live instance, never guessed from source text.
// No `vscode` imports: this runs in the preview process.

// github-slugger's class, expressed with Unicode properties: it keeps the Alphabetic property
// (letters plus letter-like numerals and symbols such as Ⅱ and Ⓐ), marks, decimal digits,
// connector punctuation, space, and hyphen. Verified against the shipped table over every
// code point; the only differences are characters assigned in Unicode versions newer than
// VSCode's generated table (rare in headings).
const DROPPED_RE = /[^\p{Alphabetic}\p{M}\p{Nd}\p{Pc}\- ]/gu;

export function githubSlugify(heading: string): string {
  return heading.trim().toLowerCase().replace(DROPPED_RE, '').replace(/\s/g, '-');
}

type Tok = {
  type: string;
  map?: [number, number] | null;
  children?: Tok[] | null;
  content: string;
};

// VSCode's heading text: recurse into children, keep only tokens that render as text.
function plainText(tok: Tok): string {
  if (tok.children) return tok.children.map(plainText).join('');
  switch (tok.type) {
    case 'text':
    case 'emoji':
    case 'code_inline':
      return tok.content;
    default:
      return '';
  }
}

// Line number (0-based) → preview anchor id for every heading in `text`, tokenized by `md`.
export function previewHeadingAnchors(md: MarkdownIt, text: string): Map<number, string> {
  const tokens = md.parse(text, {}) as Tok[];
  const anchors = new Map<number, string>();
  const seen = new Map<string, number>();
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok.type !== 'heading_open' || !tok.map) continue;
    const inline = tokens[i + 1];
    let slug = githubSlugify(inline ? plainText(inline) : '');
    const count = seen.get(slug);
    if (count === undefined) {
      seen.set(slug, 0);
    } else {
      seen.set(slug, count + 1);
      slug = githubSlugify(`${slug}-${count + 1}`);
    }
    anchors.set(tok.map[0], slug);
  }
  return anchors;
}
