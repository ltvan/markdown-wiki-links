# VSCode Wiki-Links Extension

This extension brings Obsidian-style wiki-links to VSCode. Create links between Markdown files with a simple `[[file name]]` syntax, follow them with a click, preview them on hover, embed content inline with `![[...]]`, and keep links correct automatically when files are renamed.

https://obsidian.md/help/links

## Wiki-link Syntax

Use `[[wiki-link]]` for markdown and media files within the workspace only.

<!-- prettier-ignore -->
```markdown
[[file name]]                          Link to file
[[file name|Display Text]]             Custom display text
[[file name#Heading]]                  Link to heading
[[file name#^block-id]]                Link to block
[[#Heading in same file]]              Same-file heading link
```

A paired `[...]` inside a heading or display text is plain text, as in regular Markdown links:
`[[file name#Edge cases [brackets]]]` works as written. Only `|` (it starts display text) and
unpaired or nested brackets cannot appear; autocomplete inserts such headings as their slug
(`## Options | Flags` → `[[file name#options--flags]]`), which resolves like any heading link.

A heading may carry footnote references; link to it without them. `## Setup[^1]` is reached as
`[[file name#Setup]]` and autocomplete offers `Setup`. Preview navigation lands on the heading
whether or not a footnote extension (such as `bierner.markdown-footnotes`) is installed — the
anchor is computed with the same Markdown engine the preview renders with. Hover a footnote
reference to read its definition — in the editor always, and in the preview whenever a footnote
extension has rendered the footnotes. `F12` jumps between a reference and its definition;
`Shift+F12` lists all of them.

Define a block ID by appending `^block-id` to any paragraph:

```markdown
This paragraph can be linked to. ^my-block-id
```

For lists and quotes, place the block ID on a separate line after the block:

```markdown
> A quote block

^quote-id
```

Prefix any wikilink with `!` to embed its content inline:

<!-- prettier-ignore -->
```markdown
![[file name]]                         Embed full file
![[file name#Heading]]                 Embed section
![[image.png]]                         Embed image
![[image.png|300]]                     Embed image with width
```

## Features

- Support `.md` and `.markdown` file extensions.
- Click to follow the link (headings and block IDs jump to the right line).
- Hover to preview the linked file or section; hovering an image embed previews the image. Hovering a footnote reference `[^1]` shows its definition; the same hover card appears in the Markdown preview when a footnote extension (such as `bierner.markdown-footnotes`) renders footnotes.
- Press `F12` on a footnote reference (or Ctrl/Cmd-click its label) to jump to its definition; `F12` on the definition's `[^label]` jumps back to the references. `Shift+F12` lists every reference and the definition.
- Autocomplete file names while typing `[[` or `![[`, ranked by closest folder. After `#`, autocomplete switches to the target file's headings and block IDs (and the current file's, for `[[#`), shown in document order with the heading level (H1, H2, …) beside each entry.
- Auto update links when renaming or moving files (Markdown and media targets alike) — moving or renaming a whole folder updates links to every file inside it. Rewriting is resolution-verified: a link is rewritten exactly when its resolution would change, so links inside moved files are re-anchored to keep their targets, links threatened by an incoming name collision are pinned, and links that still resolve (including `[[Case]]`/`[[name.md]]` variants) are left untouched.
- Both `[[...]]` links and `![[...]]` embeds rendered in the Markdown preview — links are navigable, embeds expand inline with cycle protection; an unresolved link is shown as its original `[[...]]` text so the broken reference stays visible; occurrences inside backtick code spans or fenced code blocks are left as-is.
- Resolved wiki-links are colored in the editor; unresolved ones are dimmed — based on real resolution, so spaces and Unicode in names color correctly.
- Diagnostics flag broken or ambiguous wiki-links in open files; **Wiki Links: Scan Workspace for Broken Links** checks every Markdown file in the workspace and lists all of them in the Problems pane.
- Support both unique file name and relative file name resolution:
  - A bare `[[file name]]` resolves by unique base name across the workspace. If the name is ambiguous, a file directly under the workspace root wins; otherwise resolution walks up from the current file to the closest parent folder containing a match.
  - A relative `[[folder1/folder2/file name]]` resolves to the unique file whose path ends with `folder1/folder2/file name.md` (or `.markdown`). If more than one file matches, the link is left unresolved.
  - `..` segments and absolute paths are not allowed — links never resolve outside the workspace.

## Commands

Run these from the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command                                       | What it does                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Wiki Links: Scan Workspace for Broken Links` | Reads every Markdown file in every workspace folder (open or not, honoring `wikiLinks.index.excludeFolders`), reports each unresolved or ambiguous wiki-link in the Problems pane, and shows a summary notification with a **Show Problems** button. Unopened files are read as UTF-8. Results stay in the pane until the next scan or the file is deleted or renamed. |
| `Wiki Links: Rebuild Index`                   | Re-scans the workspace for link targets. Use it if links stop resolving after large external changes.                                                                                                                                                                                                                                                                  |

## Try it

The [`samples/`](samples/README.md) folder is a small, human-readable workspace that demonstrates
every feature above — each page explains one part of the syntax and uses it live. Open the folder
in VSCode with the extension installed, or press `F5` in this repository and choose
**Run Extension (samples)**.

## Configuration

| Setting                          | Default                                                           | Purpose                                                                                                                                                                |
| -------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wikiLinks.embed.maxDepth`       | `3`                                                               | Maximum recursion depth when expanding nested `![[...]]` embeds in the Markdown preview.                                                                               |
| `wikiLinks.hover.imageMaxHeight` | `240`                                                             | Maximum height (px) for image previews in hover popups.                                                                                                                |
| `wikiLinks.indexMaxFiles`        | `50000`                                                           | Soft cap on indexed files; a workspace above the cap shows a notification and indexes only the first N files.                                                          |
| `wikiLinks.index.excludeFolders` | `.git`, `node_modules`, `.hg`, `.svn`, `.bzr`, `bower_components` | Folder names excluded from the index, matched at any depth, so wiki-links never resolve into vendor or VCS directories. Rename link-rewriting skips these folders too. |

## Development

Requires Node.js ≥ 22.13 and pnpm. The pnpm version is pinned in `package.json` (`devEngines.packageManager`); any pnpm 11 you have installed downloads and runs the pinned version automatically inside this repository, and `npm` commands are refused by design — use pnpm.

```sh
pnpm install        # install dependencies
pnpm build          # bundle the extension into dist/
pnpm test           # lint, build, then run unit + end-to-end tests
pnpm test:unit      # fast pure-logic unit tests
pnpm test:e2e       # end-to-end tests in a real VSCode Extension Development Host
```

Press `F5` in VSCode to launch the extension in an Extension Development Host for manual testing.
