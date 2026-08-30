import * as fs from 'fs/promises';

import * as vscode from 'vscode';

import { parseLinks } from '../core/parser/linkParser';
import { parseEmbeds } from '../core/parser/embedParser';
import { resolveTarget } from '../core/resolver/resolveTarget';
import { lineForFragment } from '../core/blocks/sectionSlice';
import { buildFenceMask } from '../core/fenceMask';

import { IndexService } from './indexService';
import { toRange } from './ranges';
import { isInsideWorkspaceReal } from './workspaceBoundary';

export class WikiDocumentLinkProvider implements vscode.DocumentLinkProvider {
  constructor(private idx: IndexService) {}

  async provideDocumentLinks(doc: vscode.TextDocument): Promise<vscode.DocumentLink[]> {
    const text = doc.getText();
    const mask = buildFenceMask(text);
    const refs = [...parseLinks(text, mask), ...parseEmbeds(text, mask)];
    const snap = this.idx.snapshotFor(doc.uri.fsPath);
    const out: vscode.DocumentLink[] = [];
    for (const r of refs) {
      const resolved = resolveTarget(r, doc.uri.fsPath, snap);
      if (!resolved) continue;
      const targetUri = vscode.Uri.file(resolved.fsPath);
      if (!(await isInsideWorkspaceReal(targetUri))) continue;
      let final = targetUri;
      if (r.fragment) {
        const targetText =
          resolved.fsPath === doc.uri.fsPath ? text : await safeRead(resolved.fsPath);
        const line = lineForFragment(r.fragment, targetText);
        if (line !== undefined) final = targetUri.with({ fragment: `L${line + 1}` });
      }
      out.push(new vscode.DocumentLink(toRange(doc, r.range), final));
    }
    return out;
  }
}

async function safeRead(p: string): Promise<string> {
  try {
    return await fs.readFile(p, 'utf8');
  } catch {
    return '';
  }
}
