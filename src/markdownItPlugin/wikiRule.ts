import type MarkdownIt from 'markdown-it';

import { splitFrontmatter } from '../core/frontmatter';
import { buildFenceMask, isMasked, FenceMask } from '../core/fenceMask';
import { lineForFragment } from '../core/blocks/sectionSlice';

import { previewHeadingAnchors } from './headingAnchors';

export type EmbedResolved =
  | { kind: 'markdown'; text: string; sourcePath: string }
  | { kind: 'image'; src: string };

// Line number → preview heading id for a document's text (see headingAnchors.ts).
export type AnchorsOf = (text: string) => Map<number, string>;

export type WikiResolver = {
  // Resolve an embed (![[...]]). `key` is `target` or `target#fragment`.
  resolveEmbed: (fromFsPath: string, key: string, sizeHint?: string) => EmbedResolved | null;
  // Resolve a link ([[...]]) to an href the Markdown preview can navigate; null = unresolved.
  // `anchorsOf` computes the preview's real heading ids for a target's text — the plugin owns
  // the markdown-it instance that decides them, the resolver owns reading the target.
  resolveLink: (
    fromFsPath: string,
    target: string,
    fragment: string | undefined,
    anchorsOf: AnchorsOf,
  ) => string | null;
};

const EMBED_RE = /!\[\[([^[\]|#\r\n]+)(?:#([^[\]|\r\n]+))?(?:\|([^[\]\r\n]+))?\]\]/g;
const LINK_RE = /(?<!!)\[\[([^[\]|#\r\n]*)(?:#([^[\]|\r\n]+))?(?:\|([^[\]\r\n]+))?\]\]/g;

export function wikiPlugin(
  md: MarkdownIt,
  opts: {
    resolver: WikiResolver;
    maxDepth?: number;
    // The fsPath of the file the preview is rendering. VSCode tokenizes the preview by string,
    // so a core rule cannot discover this itself (env.currentDocument is undefined at tokenize
    // time); the extension supplies it. Used to seed the embed-cycle ancestor set.
    getDocumentPath?: () => string | undefined;
  },
): void {
  const maxDepth = opts.maxDepth ?? 3;
  md.core.ruler.before('normalize', 'wiki-links', (state) => {
    // Only rewrite for preview rendering. VSCode's built-in markdown extension reuses the
    // contributed markdown-it instance for source-editor analyses too (document highlights,
    // smart-select, symbol mapping, link tracking). Those calls do not set the preview env
    // fields; mutating state.src for them leaks rewritten ranges back to the source editor
    // as bogus decorations (e.g. a "highlight" running from start of file to the next
    // backtick because the rewritten content's positions no longer align with source).
    if (!isPreviewRender(state.env)) return;
    // Leave a leading YAML frontmatter block untouched — rewriting a [[...]] value there would
    // corrupt the metadata (escaped markdown is not valid YAML).
    const { frontmatter, body } = splitFrontmatter(state.src);
    // Seed the ancestor set with the file being previewed so a file that embeds itself is
    // flagged cyclic at its first reference, instead of after one redundant self-expansion.
    const ancestors = new Set<string>();
    const self = opts.getDocumentPath?.();
    if (self) ancestors.add(self);
    state.src = frontmatter + expand(md, body, opts.resolver, '', maxDepth, ancestors);
  });
  // Embed size hints are carried as a `wl-size:` image title (no markdown syntax expresses image
  // dimensions); this rule turns that title into real width/height attributes after tokenization.
  md.core.ruler.push('wiki-image-size', applyImageSizes);
}

type AttrToken = {
  type: string;
  children?: AttrToken[] | null;
  attrGet(name: string): string | null;
  attrSet(name: string, value: string): void;
  attrIndex(name: string): number;
  attrs: [string, string][] | null;
};

const SIZE_TITLE_RE = /^wl-size:(\d+)(?:x(\d+))?$/;

function applyImageSizes(state: { tokens: AttrToken[] }): void {
  for (const block of state.tokens) {
    for (const tok of block.children ?? []) {
      if (tok.type !== 'image') continue;
      const m = (tok.attrGet('title') ?? '').match(SIZE_TITLE_RE);
      if (!m) continue;
      tok.attrSet('width', m[1]);
      if (m[2]) tok.attrSet('height', m[2]);
      const titleIndex = tok.attrIndex('title');
      if (titleIndex >= 0 && tok.attrs) tok.attrs.splice(titleIndex, 1);
    }
  }
}

function expand(
  md: MarkdownIt,
  src: string,
  resolver: WikiResolver,
  fromFsPath: string,
  depth: number,
  ancestors: Set<string>,
): string {
  // wikiPlugin runs as a preprocessor, before markdown-it tokenizes fenced/inline code spans.
  // Skip matches inside ``...`` / ```...``` / ~~~...~~~ so syntax shown literally in code stays
  // literal in the preview.
  //
  // Two passes, two masks: expandEmbeds rewrites the source (embed bodies may be longer or
  // shorter than `![[...]]`), so offsets in the post-embed text are not in the same coordinate
  // space as the pre-embed mask. Sharing one mask across both passes causes random links after
  // an embed to land in stale mask intervals and be wrongly skipped. Build a fresh mask for
  // rewriteLinks from the post-embed text.
  const afterEmbeds = expandEmbeds(
    md,
    src,
    resolver,
    fromFsPath,
    depth,
    ancestors,
    buildFenceMask(src),
  );
  return rewriteLinks(md, afterEmbeds, resolver, fromFsPath, buildFenceMask(afterEmbeds));
}

function expandEmbeds(
  md: MarkdownIt,
  src: string,
  resolver: WikiResolver,
  fromFsPath: string,
  depth: number,
  ancestors: Set<string>,
  mask: FenceMask,
): string {
  // String.prototype.replace passes (match, ...groups, offset, fullString) to the callback —
  // the offset lets us check whether the match starts inside a fenced/inline code span.
  if (depth <= 0) {
    return src.replace(EMBED_RE, (_full, _t, _f, _s, offset: number) =>
      isMasked(mask, offset) ? _full : '> ⚠️ Embed depth exceeded',
    );
  }
  return src.replace(EMBED_RE, (_full, target, fragment, sizeHint, offset: number) => {
    if (isMasked(mask, offset)) return _full;
    const key = fragment ? `${target}#${fragment}` : target;
    const r = resolver.resolveEmbed(fromFsPath, key, sizeHint);
    if (!r) return `*Unresolved embed: ${mdEscape(target)}*`;
    if (r.kind === 'image') {
      // Emit a markdown image token (not raw <img>) so VSCode's preview rewrites the src to a
      // webview-loadable resource URI. The <> destination form tolerates spaces in the path; the
      // size hint rides along as a title that the wiki-image-size rule converts to width/height.
      const size = sizeHint && /^\d+(?:x\d+)?$/.test(sizeHint) ? ` "wl-size:${sizeHint}"` : '';
      return `![${mdEscape(target)}](<${r.src}>${size})`;
    }
    if (ancestors.has(r.sourcePath)) return `> ⚠️ Cyclic embed: ${mdEscape(target)}`;
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(r.sourcePath);
    // Embedded content resolves its own [[links]] / ![[embeds]] relative to the embedded file.
    return expand(md, r.text, resolver, r.sourcePath, depth - 1, nextAncestors);
  });
}

function rewriteLinks(
  md: MarkdownIt,
  src: string,
  resolver: WikiResolver,
  fromFsPath: string,
  mask: FenceMask,
): string {
  const anchorsOf: AnchorsOf = (text) => previewHeadingAnchors(md, text);
  // Same-file heading links point into the text being rendered — after embeds expanded, which
  // is what the preview assigns ids to. Tokenized at most once per rewrite pass, lazily.
  let ownAnchors: Map<number, string> | undefined;
  const ownAnchor = (frag: string): string | undefined => {
    const line = lineForFragment(frag, src);
    if (line === undefined) return undefined;
    ownAnchors ??= anchorsOf(src);
    return ownAnchors.get(line);
  };
  return src.replace(LINK_RE, (full: string, target, fragment, display, offset: number) => {
    if (isMasked(mask, offset)) return full;
    const t = (target as string).trim();
    const frag = (fragment as string | undefined)?.trim();
    const label = (display as string | undefined)?.trim() ?? labelFor(t, frag);
    const own = t === '' && frag && !frag.startsWith('^') ? ownAnchor(frag) : undefined;
    const href = own ? `#${own}` : resolver.resolveLink(fromFsPath, t, frag, anchorsOf);
    // Unresolved → the original [[...]] text, escaped so markdown-it renders it literally
    // (and never as a reference-style link). Keeps the broken reference visible to the reader.
    if (!href) return mdEscape(full);
    return `[${mdEscape(label)}](<${href}>)`;
  });
}

function labelFor(target: string, fragment?: string): string {
  if (target === '') return fragment ?? '';
  return fragment ? `${target} › ${fragment}` : target;
}

// Escape characters that have special meaning in markdown inline-text positions.
function mdEscape(s: string): string {
  return s.replace(/([\\`*_{}[\]()#+\-.!|>])/g, '\\$1');
}

// VSCode's preview path passes an env object carrying preview-specific fields; non-preview
// calls (TOC, document-links, smart-select, symbol mapping) call the engine without them.
// Treat the presence of any of these fields as a positive signal of preview rendering.
// `unknown` here because markdown-it's State type is loose and these are extension-set.
function isPreviewRender(env: unknown): boolean {
  if (!env || typeof env !== 'object') return false;
  const e = env as Record<string, unknown>;
  return e.containingImages != null || e.currentDocument != null || e.resourceProvider != null;
}
