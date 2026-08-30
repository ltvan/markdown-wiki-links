import * as fs from 'fs/promises';

import * as vscode from 'vscode';

import { rankCompletions } from '../core/completion/rankCompletions';
import { rankFragmentCompletions } from '../core/completion/rankFragmentCompletions';
import { resolveTarget } from '../core/resolver/resolveTarget';

import { IndexService } from './indexService';
import { isInsideWorkspaceReal } from './workspaceBoundary';

// Splits "[[target#partial" / "![[target#partial" / "[[#partial" — target and fragment are
// captured separately. Matches up to the cursor; only used when at least one `#` is present.
// The partial fragment may contain paired [..] (plain text, like the parser) and may end in
// an unclosed "[" the user is still typing; the whole partial is what completion replaces.
const FRAGMENT_RE = /!?\[\[([^[\]\r\n|#]*)#((?:[^[\]\r\n|]|\[[^[\]\r\n|]*\])*(?:\[[^[\]\r\n|]*)?)$/;

// File-name completion context: cursor inside [[...] with no `#` yet typed on this side.
const FILE_RE = /!?\[\[([^[\]\r\n]*)$/;

export class WikiCompletionProvider implements vscode.CompletionItemProvider {
  constructor(private idx: IndexService) {}

  async provideCompletionItems(
    doc: vscode.TextDocument,
    pos: vscode.Position,
  ): Promise<vscode.CompletionItem[]> {
    const lineText = doc.lineAt(pos.line).text.slice(0, pos.character);

    const frag = lineText.match(FRAGMENT_RE);
    if (frag) return this.fragmentCompletions(doc, pos, frag[1], frag[2]);

    const file = lineText.match(FILE_RE);
    if (!file) return [];
    const query = file[1];
    const snap = this.idx.snapshotFor(doc.uri.fsPath);
    const ranked = rankCompletions(query, doc.uri.fsPath, snap);
    return ranked.map((c) => {
      const label: string | vscode.CompletionItemLabel = c.description
        ? { label: c.label, description: c.description }
        : c.label;
      const item = new vscode.CompletionItem(label, vscode.CompletionItemKind.File);
      item.insertText = c.insertText;
      item.range = new vscode.Range(pos.translate(0, -query.length), pos);
      return item;
    });
  }

  private async fragmentCompletions(
    doc: vscode.TextDocument,
    pos: vscode.Position,
    target: string,
    query: string,
  ): Promise<vscode.CompletionItem[]> {
    const targetText = await this.loadTargetText(doc, target);
    if (targetText === null) return [];
    const replaceRange = new vscode.Range(pos.translate(0, -query.length), pos);
    const candidates = rankFragmentCompletions(targetText);
    return candidates.map((c, index) => {
      const kind =
        c.kind === 'heading'
          ? vscode.CompletionItemKind.Field
          : vscode.CompletionItemKind.Reference;
      // Description shows "H2" for headings (dimmed beside the label); block-ids show no level.
      const description = c.kind === 'heading' && c.level ? `H${c.level}` : undefined;
      const label: string | vscode.CompletionItemLabel = description
        ? { label: c.label, description }
        : c.label;
      const item = new vscode.CompletionItem(label, kind);
      item.insertText = c.insertText;
      item.detail = `line ${c.line}`;
      item.range = replaceRange;
      // Preserve document order — VSCode sorts by sortText (label is the fallback).
      // Zero-pad so lexicographic sort matches numeric order up to ~10k candidates.
      item.sortText = index.toString().padStart(5, '0');
      return item;
    });
  }

  // Empty target → same file (the doc buffer). Resolved target → read from disk.
  private async loadTargetText(doc: vscode.TextDocument, target: string): Promise<string | null> {
    if (target.trim() === '') return doc.getText();
    const snap = this.idx.snapshotFor(doc.uri.fsPath);
    const resolved = resolveTarget(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { kind: 'link', target, range: { start: 0, end: 0 } } as any,
      doc.uri.fsPath,
      snap,
    );
    if (!resolved) return null;
    if (resolved.fsPath === doc.uri.fsPath) return doc.getText();
    // Hot-path symlink check: a workspace file can be a symlink pointing outside the workspace,
    // and reading it would leak that target's content as completion items. Refuse those.
    if (!(await isInsideWorkspaceReal(vscode.Uri.file(resolved.fsPath)))) return null;
    try {
      return await fs.readFile(resolved.fsPath, 'utf8');
    } catch {
      return null;
    }
  }
}
