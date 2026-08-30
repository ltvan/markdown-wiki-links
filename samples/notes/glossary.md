---
title: Glossary
summary: Terms used across the sample workspace.
---

# Glossary

Short definitions of the words the guide pages use. Every heading and block here is a link
target — try `[[glossary#` to see them in the completion list.

## Wiki-link

A reference to another file in the workspace written as `[[name]]`. The name is a file name
without extension; a fragment (`#Heading`, `#^block`) and display text (`|text`) are optional.
See [[link-syntax]].

## Embed

A wiki-link prefixed with `!`. Instead of navigating to the target, the Markdown preview expands
the target's content in place. See [[embeds]].

## Fragment

The part of a link after `#`. A plain fragment names a heading; a fragment starting with `^`
names a block ID.

## Block ID

A caret and an identifier (`^intro`) that marks one paragraph, list, or quote as a link target.
See [[block-ids]].

## Resolution

The process of turning a link's text into a file. Bare names resolve by uniqueness and closeness;
slashed names resolve by path suffix. See [[resolution]].

## Rules of thumb

A link should read as a sentence with the brackets removed. ^one-sentence

Link to the smallest thing that answers the reader's question — a block over a section, a section over a page. ^smallest-thing

- Name files for their content.
- Link the first mention, not every mention.
- Keep one topic per file.

^rules-list
