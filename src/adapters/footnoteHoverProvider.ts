import * as vscode from 'vscode';

import { buildFenceMask } from '../core/fenceMask';
import { extractFootnoteDefs, footnoteRefAt } from '../core/footnote';

// Hovering a footnote reference `[^label]` shows its definition from the same file. Footnotes
// are file-local by definition, so no index is involved; the document is parsed on demand.
export class FootnoteHoverProvider implements vscode.HoverProvider {
  provideHover(doc: vscode.TextDocument, pos: vscode.Position): vscode.Hover | undefined {
    const text = doc.getText();
    const mask = buildFenceMask(text);
    const ref = footnoteRefAt(text, doc.offsetAt(pos), mask);
    if (!ref) return undefined;
    const def = extractFootnoteDefs(text, mask).get(ref.label);
    if (!def) return undefined;
    const range = new vscode.Range(doc.positionAt(ref.range.start), doc.positionAt(ref.range.end));
    return new vscode.Hover(new vscode.MarkdownString(def.text), range);
  }
}
