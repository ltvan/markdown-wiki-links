import * as vscode from 'vscode';

import { buildFenceMask } from '../core/fenceMask';
import { extractFootnoteDefs, footnoteRefAt } from '../core/footnote';

import { toRange } from './ranges';

// Hovering a footnote reference `[^label]` shows its definition from the same file. Footnotes
// are file-local by definition, so no index is involved; the document is parsed on demand.
export class FootnoteHoverProvider implements vscode.HoverProvider {
  provideHover(doc: vscode.TextDocument, pos: vscode.Position): vscode.Hover | undefined {
    // A reference cannot span lines: skip the document read and mask for lines without "[^".
    if (!doc.lineAt(pos.line).text.includes('[^')) return undefined;
    const text = doc.getText();
    const mask = buildFenceMask(text);
    const ref = footnoteRefAt(text, doc.offsetAt(pos), mask);
    if (!ref) return undefined;
    const def = extractFootnoteDefs(text, mask).get(ref.label);
    if (!def) return undefined;
    return new vscode.Hover(new vscode.MarkdownString(def.text), toRange(doc, ref.range));
  }
}
