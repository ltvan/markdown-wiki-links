import * as assert from 'assert';

import * as vscode from 'vscode';

import { waitFor } from '../helpers/waitFor';

suite('Scan workspace command', () => {
  const ws = (): vscode.Uri => vscode.workspace.workspaceFolders![0].uri;
  const scanOnly = (): vscode.Uri => vscode.Uri.joinPath(ws(), 'unopened', 'scan-only.md');

  test('is contributed as a command', async () => {
    const all = await vscode.commands.getCommands(true);
    assert.ok(all.includes('wikiLinks.scanWorkspace'), 'wikiLinks.scanWorkspace not registered');
  });

  test('reports broken links in files that were never opened', async () => {
    const isOpen = vscode.workspace.textDocuments.some((d) => d.uri.fsPath === scanOnly().fsPath);
    assert.ok(!isOpen, 'precondition: the scan-only fixture must not be open');
    assert.strictEqual(vscode.languages.getDiagnostics(scanOnly()).length, 0, 'precondition');

    await vscode.commands.executeCommand('wikiLinks.scanWorkspace');

    await waitFor(() => vscode.languages.getDiagnostics(scanOnly()).length > 0);
    const diags = vscode.languages.getDiagnostics(scanOnly());
    assert.strictEqual(diags.length, 1);
    assert.match(diags[0].message, /unresolved|ambiguous/i);
    assert.strictEqual(diags[0].range.start.line, 2, 'the broken link is on the third line');
  });

  // Not tested here: scanned diagnostics persisting after the file is closed. The extension
  // host keeps a document opened through openTextDocument alive for minutes after its editor
  // closes, so onDidCloseTextDocument cannot be observed within a test timeout.

  test('a file with only resolvable links gets no diagnostics from the scan', async () => {
    await vscode.commands.executeCommand('wikiLinks.scanWorkspace');
    await waitFor(() => vscode.languages.getDiagnostics(scanOnly()).length > 0);
    const clean = vscode.Uri.joinPath(ws(), 'a', 'sub', 'ref.md'); // [[dup]] resolves via closest parent
    assert.strictEqual(vscode.languages.getDiagnostics(clean).length, 0);
  });
});
