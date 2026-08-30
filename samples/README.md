# Wiki-Links Sample Workspace

A small, human-readable workspace that shows every feature of the **Markdown Wiki Links**
extension in action. Each page explains one part of the `[[wiki-link]]` syntax _and_ uses it, so
you can read the explanation and try the feature on the same screen.

## How to open it

Pick either:

- **Open the folder.** In VSCode choose _File → Open Folder…_ and select this `samples/` folder
  (with the extension installed).
- **Run from source.** In the repository root press `F5` and choose the **Run Extension
  (samples)** launch configuration. An Extension Development Host opens with this folder as the
  workspace.

Then open any page below, hover a link, click it, and open the Markdown preview
(`Ctrl+Shift+V` / `Cmd+Shift+V`) to see embeds expand.

## Contents

1. [[link-syntax|Link syntax]] — the five link forms, one example each.
2. [[block-ids|Block IDs]] — how to make a paragraph, list, or quote linkable.
3. [[embeds|Embeds]] — pulling another note, section, or image inline.
4. [[resolution|How links resolve]] — bare vs. slashed targets, ambiguity, broken links.
5. [[markdown-style|Markdown writing guideline]] — house style for readable notes.

Reference notes used by the guide pages:

- [[glossary]] — terms, with headings and block IDs to link to.
- [[team/meeting-notes]] and [[personal/meeting-notes]] — two files with the same name, on purpose.

## What to look for

- Links are **colored** when they resolve and **dimmed** when they don't.
- Type `[[` anywhere to get file-name completion; type `#` after a name to get its headings and
  block IDs.
- Rename a file (`F2` in the Explorer) and watch links to it update.
- The _Problems_ panel lists broken and ambiguous links.
