import * as vscode from 'vscode';

import { findBrokenRefs } from '../core/diagnostics/findBrokenRefs';
import { IndexSnapshot, isContained } from '../core/resolver/resolveTarget';
import { computeLineStarts, positionAt, LineCharacter } from '../core/textPosition';
import { ParsedRef } from '../core/types';

import { IndexService } from './indexService';

// Edits fire onDidChangeTextDocument on every keystroke; coalesce re-parsing to one run per
// idle window so fast typing in a large document does not re-scan it on each character.
const DEBOUNCE_MS = 300;
const MESSAGE = 'Unresolved or ambiguous wiki-link';
const MARKDOWN_RE = /\.(md|markdown)$/i;
// Files read per batch during a workspace scan: enough to overlap disk latency, few enough
// that a large workspace does not open thousands of handles at once.
const SCAN_BATCH = 16;
const UTF8 = new TextDecoder('utf-8');

export type ScanResult = { files: number; problems: number; cancelled: boolean };

export class WikiDiagnostics {
  private coll = vscode.languages.createDiagnosticCollection('wikiLinks');
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  // Files whose diagnostics were published by an explicit workspace scan, fsPath → Uri.
  // Closing such a file must not drop its entry — the scan promised every problem in the
  // workspace, open or not — so results persist until the next scan or the file goes away.
  private scanned = new Map<string, vscode.Uri>();
  // A scan already running; a second invocation joins it instead of interleaving writes.
  private inFlight?: Promise<ScanResult>;

  constructor(private idx: IndexService) {}

  register(ctx: vscode.ExtensionContext): void {
    const deleteWatcher = vscode.workspace.createFileSystemWatcher('**/*', true, true, false);
    ctx.subscriptions.push(
      this.coll,
      vscode.workspace.onDidOpenTextDocument((doc) => this.update(doc)),
      vscode.workspace.onDidChangeTextDocument((e) => this.scheduleUpdate(e.document)),
      vscode.workspace.onDidCloseTextDocument((d) => {
        this.cancel(d.uri.toString());
        if (!this.scanned.has(d.uri.fsPath)) this.coll.delete(d.uri);
      }),
      // Scanned results must not outlive their file. onDidDeleteFiles/onDidRenameFiles only
      // cover operations made through VSCode; the watcher catches deletes from the shell,
      // git, or another tool (an external rename arrives as delete + create).
      vscode.workspace.onDidDeleteFiles((e) => e.files.forEach((u) => this.forget(u))),
      vscode.workspace.onDidRenameFiles((e) => e.files.forEach((f) => this.forget(f.oldUri))),
      deleteWatcher,
      deleteWatcher.onDidDelete((u) => this.forget(u)),
      { dispose: () => this.cancelAll() },
    );
    for (const doc of vscode.workspace.textDocuments) this.update(doc);
  }

  // Check every indexed Markdown file in every workspace root — open or not — and publish
  // the same diagnostics the live path produces. Replaces the previous scan's results.
  scanWorkspace(
    token?: vscode.CancellationToken,
    onProgress?: (done: number, total: number) => void,
  ): Promise<ScanResult> {
    if (!this.inFlight) {
      this.inFlight = this.runScan(token, onProgress).finally(() => (this.inFlight = undefined));
    }
    return this.inFlight;
  }

  private async runScan(
    token?: vscode.CancellationToken,
    onProgress?: (done: number, total: number) => void,
  ): Promise<ScanResult> {
    for (const uri of this.scanned.values()) this.coll.delete(uri);
    this.scanned.clear();
    const targets = this.markdownFiles();
    let problems = 0;
    let done = 0;
    for (let i = 0; i < targets.length; i += SCAN_BATCH) {
      if (token?.isCancellationRequested) return { files: done, problems, cancelled: true };
      const batch = targets.slice(i, i + SCAN_BATCH);
      const counts = await Promise.all(batch.map((t) => this.scanFile(t.fsPath, t.snap)));
      for (const n of counts) problems += n;
      done += batch.length;
      onProgress?.(done, targets.length);
    }
    return { files: done, problems, cancelled: false };
  }

  private markdownFiles(): { fsPath: string; snap: IndexSnapshot }[] {
    const out: { fsPath: string; snap: IndexSnapshot }[] = [];
    for (const folder of vscode.workspace.workspaceFolders ?? []) {
      const snap = this.idx.snapshotFor(folder.uri.fsPath);
      for (const e of snap.entries) {
        if (!MARKDOWN_RE.test(e.fsPath)) continue;
        // Nested roots: an entry is listed under every root containing it. Scan it once,
        // from the root the live providers would use for it.
        const owner = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(e.fsPath));
        if (owner && owner.uri.toString() !== folder.uri.toString()) continue;
        out.push({ fsPath: e.fsPath, snap });
      }
    }
    return out;
  }

  private async scanFile(fsPath: string, snap: IndexSnapshot): Promise<number> {
    const uri = vscode.Uri.file(fsPath);
    // An open document may have unsaved edits; diagnose what the user sees, not the disk.
    // Match the full URI: a git: diff document shares the fsPath but holds other text.
    const key = uri.toString();
    const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === key);
    let diags: vscode.Diagnostic[];
    if (open) {
      diags = toDiagnostics(findBrokenRefs(open.getText(), fsPath, snap), (o) =>
        open.positionAt(o),
      );
    } else {
      let text: string;
      try {
        text = UTF8.decode(await vscode.workspace.fs.readFile(uri));
      } catch {
        return 0; // unreadable (deleted mid-scan, permissions): nothing to report
      }
      const starts = computeLineStarts(text);
      diags = toDiagnostics(findBrokenRefs(text, fsPath, snap), (o) => positionAt(starts, o));
    }
    this.coll.set(uri, diags);
    this.scanned.set(fsPath, uri);
    return diags.length;
  }

  // Drop scanned results for a deleted/renamed file, or every scanned file under a folder.
  private forget(uri: vscode.Uri): void {
    const gone = uri.fsPath;
    for (const [fsPath, scannedUri] of [...this.scanned]) {
      if (isContained(fsPath, gone)) {
        this.scanned.delete(fsPath);
        this.coll.delete(scannedUri);
      }
    }
  }

  private scheduleUpdate(doc: vscode.TextDocument): void {
    if (doc.languageId !== 'markdown') return;
    const key = doc.uri.toString();
    this.cancel(key);
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key);
        this.update(doc);
      }, DEBOUNCE_MS),
    );
  }

  private update(doc: vscode.TextDocument): void {
    if (doc.languageId !== 'markdown') return;
    const snap = this.idx.snapshotFor(doc.uri.fsPath);
    const broken = findBrokenRefs(doc.getText(), doc.uri.fsPath, snap);
    this.coll.set(
      doc.uri,
      toDiagnostics(broken, (o) => doc.positionAt(o)),
    );
  }

  private cancel(key: string): void {
    const t = this.timers.get(key);
    if (t) {
      clearTimeout(t);
      this.timers.delete(key);
    }
  }

  private cancelAll(): void {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
  }
}

function toDiagnostics(
  broken: ParsedRef[],
  toPosition: (offset: number) => LineCharacter,
): vscode.Diagnostic[] {
  return broken.map((r) => {
    const s = toPosition(r.range.start);
    const e = toPosition(r.range.end);
    const range = new vscode.Range(s.line, s.character, e.line, e.character);
    return new vscode.Diagnostic(range, MESSAGE, vscode.DiagnosticSeverity.Information);
  });
}
