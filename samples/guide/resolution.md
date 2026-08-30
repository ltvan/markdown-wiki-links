---
title: How links resolve
summary: Bare vs. slashed targets, ambiguous names, and broken links.
---

# How links resolve

A wiki-link never contains a full path. The extension finds the file for you, and the rule it
uses depends on whether the target contains a `/`.

## Bare targets: unique name, then closest folder

`[[name]]` looks for a file called `name.md` (or `name.markdown`) anywhere in the workspace.

- If exactly one file has that name, that is the target: [[glossary]].
- If several do, a file directly under the workspace root wins.
- Otherwise resolution walks **up** from the current file's folder to the workspace root and
  takes the first folder that _directly_ contains a file with that name (subfolders are not
  searched).

This workspace has two files named `meeting-notes.md`:

```text
samples/notes/team/meeting-notes.md
samples/notes/personal/meeting-notes.md
```

From here — `samples/guide/` — neither `guide/` nor the workspace root _directly_ contains a
`meeting-notes.md`, so the walk finds nothing and a bare [[meeting-notes]] stays **ambiguous**: it
is dimmed in the editor and listed in the _Problems_ panel. Open either
`meeting-notes.md` file and you will see the same bare link resolve, because the walk starts in
the file's own folder.

## Slashed targets: unique path suffix, no walk

`[[folder/name]]` looks for the unique file whose path **ends with** `folder/name.md`. There is
no closest-folder walk — the suffix either matches one file or the link is unresolved.

- [[team/meeting-notes]] — matches one file.
- [[personal/meeting-notes]] — matches the other.
- [[notes/team/meeting-notes]] — a longer suffix works too.

Use a slash whenever a bare name would be ambiguous. Completion suggests the shortest slashed
form that is unique.

## What never resolves

- `..` segments and absolute paths are rejected — links cannot leave the workspace.
- Files in `.git`, `node_modules`, and other excluded folders (`wikiLinks.index.excludeFolders`)
  are not indexed, so links never land there.
- A target that does not exist, such as [[no-such-note]], is dimmed and reported as broken.

## Renames keep links correct

Rename or move a file — or a whole folder — and every link that would otherwise stop resolving
is rewritten. Links that still resolve to the same file are left exactly as you wrote them. Try
it: rename `glossary.md` to `terms.md` in the Explorer, then check this page and undo.

Next: [[markdown-style]].
