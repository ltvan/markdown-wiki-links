import type MarkdownIt from 'markdown-it';

import { wikiPlugin, WikiResolver } from './wikiRule';

const NULL_RESOLVER: WikiResolver = {
  resolveEmbed: () => null,
  resolveLink: () => null,
};

let activeResolver: WikiResolver = NULL_RESOLVER;

export function setResolver(r: WikiResolver): void {
  activeResolver = r;
}

// Drop the active resolver on deactivate so its closure stops pinning the IndexService.
export function resetResolver(): void {
  activeResolver = NULL_RESOLVER;
}

export function extendMarkdownIt(
  md: MarkdownIt,
  maxDepth?: number,
  getDocumentPath?: () => string | undefined,
): MarkdownIt {
  // Delegate through a stable indirection so setResolver can swap the active resolver later.
  const resolver: WikiResolver = {
    resolveEmbed: (from, key, hint) => activeResolver.resolveEmbed(from, key, hint),
    resolveLink: (from, target, frag, anchorsOf) =>
      activeResolver.resolveLink(from, target, frag, anchorsOf),
  };
  return md.use(wikiPlugin, { resolver, maxDepth, getDocumentPath });
}
