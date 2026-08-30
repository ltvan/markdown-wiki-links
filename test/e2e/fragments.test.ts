import * as assert from 'assert';

import * as vscode from 'vscode';

async function linksFor(file: string): Promise<vscode.DocumentLink[]> {
  const uri = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, file);
  await vscode.workspace.openTextDocument(uri);
  return vscode.commands.executeCommand<vscode.DocumentLink[]>('vscode.executeLinkProvider', uri);
}

suite('Fragments', () => {
  test('each fragment kind produces a link with a line fragment', async () => {
    const links = await linksFor('source.md');
    const lineFragmentLinks = links.filter((l) => (l.target?.fragment ?? '').startsWith('L'));
    // Section One, ^para-a, ^list-id, ^quote-id, and [[#Top]] all carry #L fragments.
    assert.ok(
      lineFragmentLinks.length >= 4,
      `expected >=4 line-fragment links, got ${lineFragmentLinks.length}`,
    );
  });

  test('[[#Top]] points at the source file itself', async () => {
    const ws = vscode.workspace.workspaceFolders![0].uri;
    const src = vscode.Uri.joinPath(ws, 'source.md');
    const links = await linksFor('source.md');
    assert.ok(
      links.some(
        (l) => l.target?.fsPath === src.fsPath && (l.target?.fragment ?? '').startsWith('L'),
      ),
    );
  });
});

suite('Fragments — footnotes in headings', () => {
  const ws = (): vscode.Uri => vscode.workspace.workspaceFolders![0].uri;

  test('[[target#Footnoted]] follows to the "## Footnoted[^1]" heading line', async () => {
    const links = await linksFor('source.md');
    const targetDoc = await vscode.workspace.openTextDocument(
      vscode.Uri.joinPath(ws(), 'target.md'),
    );
    const headingLine = targetDoc
      .getText()
      .split(/\r?\n/)
      .findIndex((l) => l.startsWith('## Footnoted'));
    assert.ok(headingLine >= 0, 'fixture must contain the footnoted heading');
    const link = links.find(
      (l) =>
        (l.target?.fsPath ?? '').endsWith('target.md') &&
        l.target?.fragment === `L${headingLine + 1}`,
    );
    assert.ok(link, `expected a link targeting target.md#L${headingLine + 1}`);
  });

  test('completion after [[target# offers the heading without its footnote reference', async () => {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(ws(), 'source.md'));
    const editor = await vscode.window.showTextDocument(doc);
    const end = doc.lineAt(doc.lineCount - 1).range.end;
    await editor.edit((b) => b.insert(end, '\n[[target#'));
    const pos = doc.lineAt(doc.lineCount - 1).range.end;
    try {
      const list = await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        doc.uri,
        pos,
        '#',
      );
      const labels = list.items.map((i) => (typeof i.label === 'string' ? i.label : i.label.label));
      assert.ok(labels.includes('Footnoted'), `expected "Footnoted" among: ${labels.join(', ')}`);
      assert.ok(
        !labels.some((l) => l.includes('[^')),
        `footnote marker leaked: ${labels.join(', ')}`,
      );
    } finally {
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    }
  });
});

suite('Footnote hover (editor)', () => {
  const ws = (): vscode.Uri => vscode.workspace.workspaceFolders![0].uri;

  test('hovering a [^1] reference shows the footnote text', async () => {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(ws(), 'target.md'));
    const offset = doc.getText().indexOf('Footnoted[^1]') + 'Footnoted[^'.length;
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      doc.uri,
      doc.positionAt(offset),
    );
    const txt = hovers
      .flatMap((h) =>
        h.contents.map((c) => (typeof c === 'string' ? c : (c as vscode.MarkdownString).value)),
      )
      .join('\n');
    assert.ok(txt.includes('The footnote text.'), `hover was: ${txt}`);
  });

  test('hovering the definition line itself shows nothing from the footnote provider', async () => {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(ws(), 'target.md'));
    const offset = doc.getText().indexOf('[^1]: The footnote text.') + 2;
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      doc.uri,
      doc.positionAt(offset),
    );
    const txt = hovers
      .flatMap((h) =>
        h.contents.map((c) => (typeof c === 'string' ? c : (c as vscode.MarkdownString).value)),
      )
      .join('\n');
    assert.ok(!txt.includes('The footnote text.'), `unexpected hover: ${txt}`);
  });
});
