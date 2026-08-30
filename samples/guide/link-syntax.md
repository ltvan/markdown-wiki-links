---
title: Link syntax
summary: The five forms of a wiki-link, with a live example of each.
---

# Link syntax

A wiki-link points at another Markdown file in this workspace by name. You never type a full path
or the `.md` extension — just the file name, and optionally a _fragment_ (the part after `#`) and
display text:

```text
[[ target [#fragment] [|display] ]]
```

Every form below is live. Hover it for a preview; click it to follow.

## 1. Link to a file

Write the file name inside double brackets. The `.md` extension is implied.

> Our shared terms live in [[glossary]].

## 2. Custom display text

Add `|` and the text you want readers to see. The target stays the same; only the label changes.

> See the [[glossary|project glossary]] before your first review.

Display text is free-form — spaces, punctuation, and Unicode are all fine.

## 3. Link to a heading

Add `#` and the heading text to land on a section instead of the top of the file.

> The [[glossary#Wiki-link]] entry explains the term itself.

Type `[[glossary#` and the completion list switches from file names to that file's headings, in
document order, with the level (H1, H2, …) shown next to each.

A paired `[...]` in a heading is plain text, as in regular Markdown links — the heading below is
reached as [[#Edge cases [brackets]]], written exactly as it reads. Only `|` (it starts display
text) and unpaired or nested brackets cannot appear in a link; autocomplete inserts such headings
as their
slug instead.

### Edge cases [brackets]

Square brackets in a heading are fine for readers and for links alike.

## 4. Link to a block

Add `#^` and a block ID to land on a single paragraph, list, or quote. The target file has to
define the ID first — see [[block-ids]] for how.

> The one-sentence rule is in [[glossary#^one-sentence]].

## 5. Same-file link

Leave the target empty to link within the current file.

> Jump back to [[#Link syntax]], or down to [[#Combining forms]].

## Combining forms

Fragments and display text combine freely:

> [[glossary#Embed|What "embed" means]] · [[glossary#^one-sentence|the one-sentence rule]] ·
> [[#1. Link to a file|start over]]

## Where links are ignored

Anything inside backticks or a fenced code block is left alone — no coloring, no completion, no
navigation. That is how this page can show `[[glossary]]` as literal text.

Next: [[block-ids]] → [[embeds]] → [[resolution]].
