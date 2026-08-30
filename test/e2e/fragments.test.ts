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

suite('Fragments — headings with link-unsafe characters', () => {
  const ws = (): vscode.Uri => vscode.workspace.workspaceFolders![0].uri;

  test('the completion list survives typing a bracket inside the fragment', async () => {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(ws(), 'source.md'));
    const editor = await vscode.window.showTextDocument(doc);
    const end = doc.lineAt(doc.lineCount - 1).range.end;
    await editor.edit((b) => b.insert(end, '\n[[target#Config ['));
    try {
      const pos = doc.lineAt(doc.lineCount - 1).range.end;
      const list = await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        doc.uri,
        pos,
      );
      const labels = list.items.map((i) => (typeof i.label === 'string' ? i.label : i.label.label));
      assert.ok(
        labels.includes('Config [beta]'),
        `expected completions, got: ${labels.join(', ')}`,
      );
    } finally {
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    }
  });

  test('picking "Config [beta]" from completion inserts a fragment that resolves', async () => {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(ws(), 'source.md'));
    const editor = await vscode.window.showTextDocument(doc);
    const end = doc.lineAt(doc.lineCount - 1).range.end;
    await editor.edit((b) => b.insert(end, '\n[[target#'));
    try {
      const pos = doc.lineAt(doc.lineCount - 1).range.end;
      const list = await vscode.commands.executeCommand<vscode.CompletionList>(
        'vscode.executeCompletionItemProvider',
        doc.uri,
        pos,
        '#',
      );
      const item = list.items.find(
        (i) => (typeof i.label === 'string' ? i.label : i.label.label) === 'Config [beta]',
      );
      assert.ok(item, 'expected the bracketed heading among the completions');
      const inserted = typeof item!.insertText === 'string' ? item!.insertText : item!.label;
      await editor.edit((b) => b.insert(doc.lineAt(doc.lineCount - 1).range.end, `${inserted}]]`));
      const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
        'vscode.executeLinkProvider',
        doc.uri,
      );
      const targetDoc = await vscode.workspace.openTextDocument(
        vscode.Uri.joinPath(ws(), 'target.md'),
      );
      const headingLine = targetDoc
        .getText()
        .split(/\r?\n/)
        .findIndex((l) => l.startsWith('## Config [beta]'));
      const lastLine = doc.lineCount - 1;
      const link = links.find((l) => l.range.start.line === lastLine);
      assert.ok(
        link?.target,
        `the inserted text must form a resolvable link: ${doc.lineAt(lastLine).text}`,
      );
      assert.strictEqual(link!.target!.fragment, `L${headingLine + 1}`);
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

suite('Footnote go-to-definition (F12)', () => {
  const ws = (): vscode.Uri => vscode.workspace.workspaceFolders![0].uri;
  const locationsAt = async (
    doc: vscode.TextDocument,
    offset: number,
  ): Promise<vscode.Location[]> => {
    const result = await vscode.commands.executeCommand<(vscode.Location | vscode.LocationLink)[]>(
      'vscode.executeDefinitionProvider',
      doc.uri,
      doc.positionAt(offset),
    );
    return (result ?? []).map((l) =>
      'targetUri' in l ? new vscode.Location(l.targetUri, l.targetRange) : l,
    );
  };

  test('F12 on a [^1] reference goes to its definition line', async () => {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(ws(), 'target.md'));
    const text = doc.getText();
    const locs = await locationsAt(doc, text.indexOf('Footnoted[^1]') + 'Footnoted[^'.length);
    const defLine = doc.positionAt(text.indexOf('[^1]: The footnote text.')).line;
    assert.ok(
      locs.some((l) => l.uri.fsPath === doc.uri.fsPath && l.range.start.line === defLine),
      `expected a location on line ${defLine}, got ${locs.map((l) => l.range.start.line).join(', ')}`,
    );
  });

  test('F12 on the definition goes back to the reference', async () => {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(ws(), 'target.md'));
    const text = doc.getText();
    const locs = await locationsAt(doc, text.indexOf('[^1]: The footnote text.') + 2);
    // The fixture references [^1] twice — in the heading and in the body — so F12 offers both.
    const headingLine = doc.positionAt(text.indexOf('Footnoted[^1]')).line;
    const bodyLine = doc.positionAt(text.indexOf('here.[^1]')).line;
    const lines = locs
      .filter((l) => l.uri.fsPath === doc.uri.fsPath)
      .map((l) => l.range.start.line)
      .sort((a, b) => a - b);
    assert.deepStrictEqual(lines, [headingLine, bodyLine]);
  });

  test('Find All References (Shift+F12) on a reference lists every reference and the definition', async () => {
    const doc = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(ws(), 'target.md'));
    const text = doc.getText();
    const refs = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      doc.uri,
      doc.positionAt(text.indexOf('here.[^1]') + 'here.[^'.length),
    );
    // VSCode's built-in Markdown extension also reports the [^1] usages (it sees a reference-
    // style link with label "^1", ranged on the label) and the command concatenates providers'
    // results, so compare the distinct lines rather than counting ranges. Only this extension
    // knows the definition line, so dropping it would still fail the assertion.
    const lines = [
      ...new Set(
        (refs ?? []).filter((l) => l.uri.fsPath === doc.uri.fsPath).map((l) => l.range.start.line),
      ),
    ].sort((a, b) => a - b);
    const expected = [
      text.indexOf('Footnoted[^1]'),
      text.indexOf('here.[^1]'),
      text.indexOf('[^1]: The footnote text.'),
    ]
      .map((o) => doc.positionAt(o).line)
      .sort((a, b) => a - b);
    assert.deepStrictEqual(lines, expected);
  });
});
