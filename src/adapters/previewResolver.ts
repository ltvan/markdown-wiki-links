import * as fs from 'fs';
import * as path from 'path';

import * as vscode from 'vscode';

import { resolveTarget, relSuffixMatches, IndexSnapshot } from '../core/resolver/resolveTarget';
import { sliceSection, lineForFragment } from '../core/blocks/sectionSlice';
import { slugify } from '../core/blocks/headingExtractor';
import { stripFrontmatter } from '../core/frontmatter';
import { AnchorsOf, EmbedResolved, WikiResolver } from '../markdownItPlugin/wikiRule';

import { IndexService } from './indexService';
import { isInsideWorkspaceRealSync } from './workspaceBoundary';

const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg)$/i;

export function createPreviewResolver(idx: IndexService): WikiResolver {
  // markdown-it is synchronous, so every resolver method is sync.
  return {
    resolveEmbed: (fromFsPath, key) => {
      const [target, fragment] = key.split('#');
      const snap = snapshotFrom(idx, fromFsPath);
      const base = basePath(fromFsPath, snap);
      if (IMAGE_RE.test(target)) return resolveImage(target, snap);
      return resolveMarkdownEmbed(target, fragment, snap, base);
    },
    resolveLink: (fromFsPath, target, fragment, anchorsOf) => {
      const snap = snapshotFrom(idx, fromFsPath);
      const from = basePath(fromFsPath, snap);
      if (target === '') {
        // Same-file fragment link. The plugin resolves same-file heading anchors itself from
        // the text it renders; this is the fallback for block ids and unknown headings.
        return fragment ? '#' + slugify(fragment.replace(/^\^/, '')) : null;
      }
      const resolved = resolveTarget(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { kind: 'link', target, fragment, range: { start: 0, end: 0 } } as any,
        from,
        snap,
      );
      if (!resolved || !isInsideWorkspaceRealSync(vscode.Uri.file(resolved.fsPath))) return null;
      // Workspace-root-absolute href: document-independent (see resolveImage for why).
      let href = '/' + path.relative(snap.workspaceRoot, resolved.fsPath).split(path.sep).join('/');
      // Heading fragments map to preview anchors; block-id fragments have no preview anchor.
      if (fragment && !fragment.startsWith('^')) {
        href += '#' + (targetAnchor(resolved.fsPath, fragment, anchorsOf) ?? slugify(fragment));
      }
      return href;
    },
  };
}

// The preview id of the heading `fragment` names in the target file, as the preview's own
// engine would assign it (see markdownItPlugin/headingAnchors.ts). Reading is sync because
// markdown-it is sync and the render is something the user is waiting for; the text and its
// anchors are cached per file version so N links to one target cost one read and one parse.
const TARGET_CACHE_MAX = 64;
type TargetEntry = { mtimeMs: number; text: string; anchors?: Map<number, string> };
const targetCache = new Map<string, TargetEntry>();

function targetAnchor(fsPath: string, fragment: string, anchorsOf: AnchorsOf): string | undefined {
  try {
    const mtimeMs = fs.statSync(fsPath).mtimeMs;
    let entry = targetCache.get(fsPath);
    if (!entry || entry.mtimeMs !== mtimeMs) {
      entry = { mtimeMs, text: fs.readFileSync(fsPath, 'utf8') };
      targetCache.delete(fsPath);
      if (targetCache.size >= TARGET_CACHE_MAX) {
        targetCache.delete(targetCache.keys().next().value as string); // oldest insertion
      }
      targetCache.set(fsPath, entry);
    }
    const line = lineForFragment(fragment, entry.text);
    if (line === undefined) return undefined;
    entry.anchors ??= anchorsOf(entry.text);
    return entry.anchors.get(line);
  } catch {
    return undefined;
  }
}

function snapshotFrom(idx: IndexService, fromFsPath: string): IndexSnapshot {
  return idx.snapshotFor(fromFsPath || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '');
}

function basePath(fromFsPath: string, snap: IndexSnapshot): string {
  return fromFsPath || path.join(snap.workspaceRoot, '_.md');
}

function resolveImage(target: string, snap: IndexSnapshot): EmbedResolved | null {
  // relSuffixMatches, not a raw endsWith: relPath uses backslashes on Windows, and endsWith
  // has no segment boundary (target 'photo.png' must not match 'my-photo.png').
  const hit = snap.entries.find((e) => relSuffixMatches(e.relPath, target));
  if (!hit) return null;
  const uri = vscode.Uri.file(hit.fsPath);
  if (!isInsideWorkspaceRealSync(uri)) return null;
  // The markdown-it plugin runs at tokenization time, where VSCode does not expose the source
  // document — so a document-relative path is impossible. A workspace-root-absolute path (leading
  // slash) is document-independent: VSCode's preview resolves it against the workspace folder root.
  const src = '/' + path.relative(snap.workspaceRoot, hit.fsPath).split(path.sep).join('/');
  return { kind: 'image', src };
}

function resolveMarkdownEmbed(
  target: string,
  fragment: string | undefined,
  snap: IndexSnapshot,
  fromFsPath: string,
): EmbedResolved | null {
  const resolved = resolveTarget(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { kind: 'embed', target, fragment, range: { start: 0, end: 0 } } as any,
    fromFsPath,
    snap,
  );
  if (!resolved || !isInsideWorkspaceRealSync(vscode.Uri.file(resolved.fsPath))) return null;
  try {
    const full = fs.readFileSync(resolved.fsPath, 'utf8');
    const text = fragment ? sliceSection(fragment, full) || full : stripFrontmatter(full);
    return { kind: 'markdown', text, sourcePath: resolved.fsPath };
  } catch {
    return null;
  }
}
