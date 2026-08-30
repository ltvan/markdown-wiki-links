import { parseLinks } from '../parser/linkParser';
import { resolveTarget, IndexSnapshot } from '../resolver/resolveTarget';
import { ParsedRef } from '../types';

// The one definition of "a broken wiki-link": a [[...]] ref (outside code) whose target does
// not resolve — missing, ambiguous, or rejected. Shared by the live per-document diagnostics
// and the on-demand workspace scan so both surface exactly the same problems. Pure: no vscode.
export function findBrokenRefs(text: string, fromFsPath: string, idx: IndexSnapshot): ParsedRef[] {
  return parseLinks(text).filter((ref) => !resolveTarget(ref, fromFsPath, idx));
}
