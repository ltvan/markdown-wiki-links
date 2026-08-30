import * as vscode from 'vscode';

import { parseLinks } from '../core/parser/linkParser';
import { parseEmbeds } from '../core/parser/embedParser';
import { buildFenceMask } from '../core/fenceMask';
import { innerRange } from '../core/parser/refRange';
import { resolveTarget } from '../core/resolver/resolveTarget';

import { IndexService } from './indexService';
import { toRange } from './ranges';

// Edits fire onDidChangeTextDocument per keystroke; coalesce re-decoration to one pass per
// idle window so a large document is not re-scanned on every character.
const DEBOUNCE_MS = 250;

// Colours `[[...]]` / `![[...]]` in the editor by whether the resolver can actually resolve
// the target — resolved links take the editor link colour, unresolved ones are dimmed.
// This reflects real resolution (spaces, Unicode, every character the parser accepts),
// unlike a TextMate grammar that pattern-matches the link text.
export class WikiDecorations {
  private resolved = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('textLink.foreground'),
  });
  private unresolved = vscode.window.createTextEditorDecorationType({
    color: new vscode.ThemeColor('descriptionForeground'),
  });
  private timer?: ReturnType<typeof setTimeout>;

  constructor(private idx: IndexService) {}

  register(ctx: vscode.ExtensionContext): void {
    ctx.subscriptions.push(
      this.resolved,
      this.unresolved,
      vscode.window.onDidChangeVisibleTextEditors(() => this.decorateAllVisible()),
      vscode.workspace.onDidChangeTextDocument((e) => {
        if (vscode.window.visibleTextEditors.some((ed) => ed.document === e.document)) {
          this.schedule();
        }
      }),
      { dispose: () => this.cancel() },
    );
    this.decorateAllVisible();
  }

  private schedule(): void {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.decorateAllVisible();
    }, DEBOUNCE_MS);
  }

  private decorateAllVisible(): void {
    for (const editor of vscode.window.visibleTextEditors) this.decorate(editor);
  }

  private decorate(editor: vscode.TextEditor): void {
    if (editor.document.languageId !== 'markdown') return;
    const doc = editor.document;
    const text = doc.getText();
    const mask = buildFenceMask(text);
    const refs = [...parseLinks(text, mask), ...parseEmbeds(text, mask)];
    const snap = this.idx.snapshotFor(doc.uri.fsPath);
    const resolvedRanges: vscode.Range[] = [];
    const unresolvedRanges: vscode.Range[] = [];
    for (const ref of refs) {
      const inner = innerRange(ref);
      const range = toRange(doc, inner);
      const bucket = resolveTarget(ref, doc.uri.fsPath, snap) ? resolvedRanges : unresolvedRanges;
      bucket.push(range);
    }
    editor.setDecorations(this.resolved, resolvedRanges);
    editor.setDecorations(this.unresolved, unresolvedRanges);
  }

  private cancel(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}
