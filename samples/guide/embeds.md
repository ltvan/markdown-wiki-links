---
title: Embeds
summary: Pulling another note, one section, or an image into the page.
---

# Embeds

Prefix a wiki-link with `!` to **embed** the target instead of linking to it. In the editor an
embed looks like a link (hover it for the same preview); in the Markdown preview it expands
inline.

Open this page's preview (`Ctrl+Shift+V` / `Cmd+Shift+V`) to see each example expand.

## Embed a whole note

```markdown
![[glossary]]
```

![[glossary]]

Front matter (the `---` block at the top of the target) is stripped, so only the readable content
appears.

## Embed one section

Add `#` and a heading to embed that section only — from that heading up to the next heading of
any level:

```markdown
![[glossary#Embed]]
```

![[glossary#Embed]]

## Embed a single block

A block ID works too, and embeds just that block:

```markdown
![[glossary#^one-sentence]]
```

![[glossary#^one-sentence]]

## Embed an image

Images are embedded by file name too, and the file may live anywhere in the workspace:

```markdown
![[link-flow.png]]
```

![[link-flow.png]]

A plain link to an image, [[link-flow.png]], stays a link: hovering previews the image, clicking
opens it.

## Embed an image at a width

For embeds only, the text after `|` is a **width in pixels**, not display text:

```markdown
![[link-flow.png|240]]
```

![[link-flow.png|240]]

## Limits

These are deliberately not demonstrated in this workspace:

- Embeds nest: an embedded note that itself embeds another note expands too, up to
  `wikiLinks.embed.maxDepth` levels (default 3).
- A note that embeds itself — directly or through a chain — stops at the cycle and shows a
  notice instead of looping.
- Supported image types: `png`, `jpg`, `jpeg`, `gif`, `webp`, `svg`.

Next: [[resolution]].
