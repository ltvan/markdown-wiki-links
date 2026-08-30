import * as vscode from 'vscode';

import { buildFenceMask } from '../core/fenceMask';
import {
  extractFootnoteDefs,
  footnoteDefAt,
  footnoteRefAt,
  footnoteRefsFor,
} from '../core/footnote';

import { toRange } from './ranges';

// F12 / Ctrl-click on a footnote reference `[^label]` goes to its definition; on the
// definition's `[^label]` token it goes back to the references (VSCode peeks when there are
// several). File-local, like footnotes themselves, so no index is involved.
export class FootnoteDefinitionProvider implements vscode.DefinitionProvider {
  provideDefinition(doc: vscode.TextDocument, pos: vscode.Position): vscode.Location[] | undefined {
    // Definition requests fire on every Ctrl+mouse-move word; a token cannot span lines, so a
    // line without "[^" can be answered without reading or masking the whole document.
    if (!doc.lineAt(pos.line).text.includes('[^')) return undefined;
    const text = doc.getText();
    const mask = buildFenceMask(text);
    const offset = doc.offsetAt(pos);
    const at = (r: { start: number; end: number }): vscode.Location =>
      new vscode.Location(doc.uri, toRange(doc, r));

    const ref = footnoteRefAt(text, offset, mask);
    if (ref) {
      const def = extractFootnoteDefs(text, mask).get(ref.label);
      return def ? [at(def.range)] : undefined;
    }
    const def = footnoteDefAt(text, offset, mask);
    if (!def) return undefined;
    const refs = footnoteRefsFor(text, def.label, mask);
    return refs.length > 0 ? refs.map((r) => at(r.range)) : undefined;
  }
}
