---
title: Footnotes
summary: Footnote references, including in headings, and how links treat them.
---

# Footnotes

A footnote reference is a caret label in brackets — `[^1]`, `[^source]` — placed right after the
text it annotates. The footnote itself is defined once, anywhere in the file, as `[^1]: text`.

## Writing a footnote

```markdown
Wiki-links were popularised by early wikis.[^origin]

[^origin]: The first wiki, WikiWikiWeb, went online in 1995.
```

Wiki-links were popularised by early wikis.[^origin] The definition sits at the bottom of this
page.

## Footnotes in headings[^headings]

A heading can carry a footnote reference too — this one does. Link to the heading **without**
the reference: the marker is not part of the heading's name.

```markdown
[[#Footnotes in headings]]
[[footnotes#Footnotes in headings]]
```

Try them: [[#Footnotes in headings]] (same file) and [[footnotes#Footnotes in headings|by file name]].
Click either and the editor lands on the heading above.

The glossary does the same for its [[glossary#Footnote]] entry, so a cross-file link works
exactly like a same-file one.

## Autocomplete

Type `[[footnotes#` and the completion list shows `Footnotes in headings` — the footnote marker
is stripped, so you never have to type it, and typing it would not work anyway (`[` and `]`
cannot appear inside a wiki-link).

## In the preview

Open the preview (`Ctrl+Shift+V` / `Cmd+Shift+V`). VSCode's built-in preview shows footnote
markers as literal text; a footnote extension such as `bierner.markdown-footnotes` renders them
as superscript links with the definitions listed at the end of the page. The heading links above
jump to the right heading in **both** cases: the extension computes the preview's heading anchor
with the same Markdown engine the preview uses, so it follows whatever plugins are installed.

Next: back to the [[link-syntax|link syntax]] page, or the [start page](../README.md).

[^origin]: The first wiki, WikiWikiWeb, went online in 1995.

[^headings]: Footnote references in headings are common in academic notes and changelogs.
