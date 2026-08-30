import * as assert from 'assert';

import * as vscode from 'vscode';

import { waitFor } from '../helpers/waitFor';

// Runs with samples/ as the workspace: the handbook must behave exactly as its pages promise.
suite('Samples handbook', () => {
  const ws = (): vscode.Uri => vscode.workspace.workspaceFolders![0].uri;
  const open = (rel: string): Thenable<vscode.TextDocument> =>
    vscode.workspace.openTextDocument(vscode.Uri.joinPath(ws(), ...rel.split('/')));

  // Only the links the handbook deliberately breaks may produce diagnostics.
  const expectedDiagnostics: Record<string, string[]> = {
    'guide/resolution.md': ['[[meeting-notes]]', '[[no-such-note]]'],
    'guide/markdown-style.md': ['[[meeting-notes|the latest sync]]'],
  };

  test('diagnostics appear only on the intentional demo links', async () => {
    const files = await vscode.workspace.findFiles('**/*.md');
    const docs = await Promise.all(files.map((f) => vscode.workspace.openTextDocument(f)));
    for (const doc of docs) {
      const rel = vscode.workspace.asRelativePath(doc.uri).split('\\').join('/');
      const needles = expectedDiagnostics[rel] ?? [];
      if (needles.length > 0) {
        await waitFor(() => vscode.languages.getDiagnostics(doc.uri).length >= needles.length);
      }
    }
    for (const doc of docs) {
      const rel = vscode.workspace.asRelativePath(doc.uri).split('\\').join('/');
      const needles = expectedDiagnostics[rel] ?? [];
      const diags = vscode.languages.getDiagnostics(doc.uri);
      const flagged = diags.map((d) => doc.getText(d.range));
      assert.strictEqual(
        diags.length,
        needles.length,
        `${rel}: expected ${needles.length} diagnostic(s), got ${diags.length}: ${flagged.join(', ')}`,
      );
      for (const needle of needles) {
        assert.ok(
          flagged.includes(needle),
          `${rel}: expected a diagnostic on ${needle}, got: ${flagged.join(', ')}`,
        );
      }
    }
  });

  test('every page provides navigable links, and fragment links point at a line', async () => {
    const files = await vscode.workspace.findFiles('**/*.md');
    for (const file of files) {
      const doc = await vscode.workspace.openTextDocument(file);
      const rel = vscode.workspace.asRelativePath(doc.uri);
      const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
        'vscode.executeLinkProvider',
        doc.uri,
      );
      assert.ok(links.length > 0, `${rel}: expected at least one wiki-link`);
      for (const link of links) {
        assert.ok(link.target, `${rel}: link without target at ${doc.getText(link.range)}`);
        assert.ok(
          link.target!.fsPath.startsWith(ws().fsPath),
          `${rel}: ${doc.getText(link.range)} points outside the workspace`,
        );
        if (doc.getText(link.range).includes('#')) {
          assert.match(
            link.target!.fragment,
            /^L\d+$/,
            `${rel}: ${doc.getText(link.range)} should target a line`,
          );
        }
      }
    }
  });

  test('every link and embed on the embeds page has a target, and the image is one of them', async () => {
    const doc = await open('guide/embeds.md');
    const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
      'vscode.executeLinkProvider',
      doc.uri,
    );
    assert.ok(links.length >= 6, `expected the demo links, got ${links.length}`);
    assert.ok(
      links.every((l) => l.target),
      'every wiki-link on the page must have a target',
    );
    assert.ok(
      links.some((l) => /\.png$/i.test(l.target!.fsPath)),
      'expected the image embed',
    );
  });

  test('hovering the section embed on the embeds page previews just that section', async () => {
    const doc = await open('guide/embeds.md');
    const offset = doc.getText().lastIndexOf('![[glossary#Embed]]') + 3; // the first one is inside a code fence
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
    assert.ok(txt.includes('## Embed'), `hover was: ${txt}`);
    assert.ok(!txt.includes('## Fragment'), 'the next section must not be part of the preview');
  });

  test('a same-file block link on the block-ids page jumps to the block', async () => {
    const doc = await open('guide/block-ids.md');
    const links = await vscode.commands.executeCommand<vscode.DocumentLink[]>(
      'vscode.executeLinkProvider',
      doc.uri,
    );
    const self = links.filter((l) => l.target?.fsPath === doc.uri.fsPath);
    assert.ok(self.length >= 3, `expected the same-file block links, got ${self.length}`);
    assert.ok(
      self.every((l) => l.target),
      'same-file links must resolve',
    );
  });
});
