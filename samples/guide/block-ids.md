---
title: Block IDs
summary: Making a paragraph, list, or quote a link target.
---

# Block IDs

Headings are link targets automatically. Anything else — a paragraph, a list, a quote — becomes a
target when you give it a **block ID**: a caret followed by letters, digits, dashes, or
underscores.

## Paragraphs: append the ID

For a paragraph, put the ID at the end of its last line, after a space:

```markdown
This paragraph can be linked to. ^my-block-id
```

Here is a real one. The ID is ordinary text, so it shows in the preview as well as the source:

This paragraph is a link target. Link to it with `[[block-ids#^intro]]`. ^intro

Try it: [[#^intro]].

## Lists and quotes: put the ID on the next line

For a list or a blockquote, put the ID on its own line right after the block. A blank line in
between is optional, but keeps the source readable:

```markdown
- first item
- second item

^my-list
```

The list below is defined exactly that way:

- Write the block
- Leave one blank line
- Put `^id` alone on the next line

^checklist

And a quote:

> A block ID names one block, not a span of them. Link to the block, not the page, when the reader
> needs a single fact.

^single-fact

Links: [[#^checklist]] · [[#^single-fact]]

## Naming

- Use lowercase, digits, and dashes: `^step-1`, `^why-not`.
- Keep IDs unique within a file; if an ID is defined twice, the later definition wins.
- Prefer a name that says _what_ the block is (`^install-command`) over where it is (`^para-3`).

The [[glossary]] defines several blocks this way — for example [[glossary#^one-sentence]] — and
the completion list after `[[glossary#` shows them beside the headings.

Next: [[embeds]].
