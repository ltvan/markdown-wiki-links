import * as vscode from 'vscode';

// Core modules describe text spans as offset intervals; providers with a TextDocument in hand
// convert them here so the conversion is written once.
export function toRange(doc: vscode.TextDocument, r: { start: number; end: number }): vscode.Range {
  return new vscode.Range(doc.positionAt(r.start), doc.positionAt(r.end));
}
