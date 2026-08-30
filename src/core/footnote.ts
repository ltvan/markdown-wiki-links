// Footnote references — `[^label]`, label without whitespace — as written in Markdown
// (GitHub, Obsidian, markdown-it-footnote). Pure: no vscode.

const FOOTNOTE_REF_RE = /\[\^[^\s[\]]+\]/g;

// Remove every footnote reference from a line of text and tidy the whitespace it leaves
// behind, so "Setup[^1]" and "A [^a] and B" read as "Setup" and "A and B".
export function stripFootnoteRefs(text: string): string {
  if (!text.includes('[^')) return text;
  return text
    .replace(FOOTNOTE_REF_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
