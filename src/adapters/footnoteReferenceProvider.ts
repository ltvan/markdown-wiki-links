import * as vscode from 'vscode';

import { buildFenceMask } from '../core/fenceMask';
import {
  extractFootnoteDefs,
  footnoteDefAt,
  footnoteRefAt,
  footnoteRefsFor,
} from '../core/footnote';

import { toRange } from './ranges';

// Shift+F12 / Find All References from a footnote reference or its definition: every
// reference to the label, plus the definition when the caller asks for declarations.
export class FootnoteReferenceProvider implements vscode.ReferenceProvider {
  provideReferences(
    doc: vscode.TextDocument,
    pos: vscode.Position,
    context: vscode.ReferenceContext,
  ): vscode.Location[] | undefined {
    if (!doc.lineAt(pos.line).text.includes('[^')) return undefined;
    const text = doc.getText();
    const mask = buildFenceMask(text);
    const offset = doc.offsetAt(pos);
    const label = (footnoteRefAt(text, offset, mask) ?? footnoteDefAt(text, offset, mask))?.label;
    if (label === undefined) return undefined;
    const at = (r: { start: number; end: number }): vscode.Location =>
      new vscode.Location(doc.uri, toRange(doc, r));
    const out = footnoteRefsFor(text, label, mask).map((r) => at(r.range));
    if (context.includeDeclaration) {
      const def = extractFootnoteDefs(text, mask).get(label);
      if (def) out.push(at(def.range));
    }
    return out.length > 0 ? out : undefined;
  }
}
