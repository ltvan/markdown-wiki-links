---
title: Markdown writing guideline
summary: House style for notes that stay readable in source, preview, and hover.
---

# Markdown writing guideline

Wiki-links reward notes that are small, well-headed, and named for their content. These rules
keep a workspace like this one easy to read in the source editor, the preview, and the hover
popup.

## Files

- One topic per file. If a note needs a table of contents, split it.
- Name files in lowercase with dashes: `meeting-notes.md`, not `Meeting Notes (v2).md`. The
  file name is the link text people will type after `[[`, so make it unique across the
  workspace where you can.
- Avoid characters that cannot appear inside `[[...]]` — `|`, `#`, `[`, `]` — and avoid
  giving two files the same name unless you always link to them with a folder prefix (see
  [[resolution#Slashed targets: unique path suffix, no walk]]).
- Put reusable definitions in a dedicated note such as [[glossary]] and link to them instead of
  repeating them.

## Front matter

Start with a `---` block holding `title` and a one-line `summary`. It is stripped from embeds and
hover previews, and a rename never rewrites links inside it, so it is a safe place for metadata.

```markdown
---
title: Meeting notes
summary: Weekly sync, decisions only.
---
```

## Headings

- Exactly one `#` title, matching the front-matter `title`.
- Use `##` for sections and `###` sparingly. Every heading is a link target
  (`[[note#Heading]]`), so make headings specific: _Decisions_, not _Notes_.
- Do not skip levels.

## Paragraphs and emphasis

- One idea per paragraph; three to five sentences at most.
- _Italic_ for terms on first use, **bold** for warnings and UI labels, `code` for anything a
  reader would type.
- Mark a paragraph worth citing on its own with a block ID — see [[block-ids]].

## Lists

- Use `-` for bullets and `1.` for ordered steps.
- Keep items parallel: all fragments or all sentences.
- If a list is a link target, put its `^id` on the line after the list.

## Quotes

Quote sources verbatim, then link to them:

> Anything inside backticks or a fenced code block is left alone — no coloring, no completion, no
> navigation.
> — [[link-syntax#Where links are ignored|Link syntax]]

## Code

Fence code with three backticks and a language tag. Wiki-links inside code are literal, which is
how a note can talk about `[[syntax]]` without creating a link. The link below is inside a fence,
so it is not colored, not hoverable, and not rewritten in the preview:

```markdown
[[glossary#Embed]]
```

Do not nest a backtick fence inside another backtick fence: the inner fence closes the outer one
and anything after it goes live again.

## Tables

Keep tables narrow — three or four columns — and put the linkable thing in the first column:

| Note            | Purpose                        |
| --------------- | ------------------------------ |
| [[link-syntax]] | The five link forms            |
| [[block-ids]]   | Making blocks linkable         |
| [[embeds]]      | Inline notes, sections, images |
| [[resolution]]  | Bare vs. slashed targets       |
| [[glossary]]    | Shared terms                   |

## Images

Store images beside the notes that use them (here, in `media/`) and embed them by name:
`![[link-flow.png|320]]`. Give the file a descriptive name — it is the alt text people will read.

![[link-flow.png|320]]

## Footnotes

Footnote references (`[^1]`) may appear anywhere, headings included; links and completion ignore
them. See [[footnotes]] for the details.

## Links

- Link the first mention of a term, not every mention.
- Prefer heading or block links when you mean one part of a note.
- Use display text when the file name would read awkwardly mid-sentence:
  [[meeting-notes|the latest sync]] is an ambiguous bare name, so it stays dimmed — write
  [[team/meeting-notes|the team sync]] instead.

Regular Markdown links work alongside wiki-links — back to the [start page](../README.md).

Next: [[footnotes]].
