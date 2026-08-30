# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product

A VSCode extension that enables Obsidian-style `[[wiki-links]]` between Markdown files in the workspace, with click-to-follow, hover preview, autocomplete, rename-aware link updates, diagnostics for broken links, resolution-based editor coloring, and inline embeds via `![[...]]`.

Scope is **workspace-local Markdown/media only** — wiki-links must not resolve to anything outside the current workspace.

## Tech stack & commands

TypeScript, pnpm, esbuild bundling, `@vscode/test-cli` + `@vscode/test-electron` (Mocha) for tests.

- `pnpm build` — bundle the extension and the markdown-it plugin into `dist/` via esbuild
- `pnpm compile:tests` — `tsc` compiles `src/` + `test/` into `out/`
- `pnpm test:unit` — fast Mocha unit suite (`test/unit/`, no VSCode runtime)
- `pnpm test:e2e` — runs the e2e suites in a real Extension Development Host (`test/e2e/`)
- `pnpm test` — `pretest` (format check, lint, build, compile) then unit + e2e
- `pnpm lint` / `pnpm format` — ESLint / Prettier

E2e suites are split per fixture workspace in `.vscode-test.mjs` (labels: `unique`, `ambiguous`, `boundary`, `renames`, `multiroot`, `fragments`, `embeds`, `samples`); run one with `pnpm exec vscode-test --label <name>`. The `multiroot` label opens a `.code-workspace` with two roots; `samples` opens the human-readable `samples/` handbook.

## Architecture

Hexagonal layering, enforced by ESLint `no-restricted-imports`:

- `src/core/**` — pure logic, **no `vscode` imports**: parsers (`linkParser`, `embedParser`, `refRange`), `fenceMask`, `frontmatter`, extractors (`headingExtractor`, `blockIdExtractor`, `sectionSlice`), `resolver/resolveTarget`, `rename/rewriteWikiRefs`, `completion/rankCompletions`, `completion/rankFragmentCompletions` (headings + block IDs after `#`), `diagnostics/findBrokenRefs` (the one definition of a broken link, shared by live diagnostics and the workspace scan), `imageSize` (intrinsic dimensions from image headers), `pathFilter` (excluded-folder matching), `textPosition` (offset → line/character without a TextDocument). Unit-tested in plain Node.
- `src/adapters/**` — VSCode glue: `indexService`, `workspaceBoundary`, the providers (`documentLinkProvider`, `hoverProvider`, `completionProvider`), `renameHandler`, `diagnostics` (live per-open-document diagnostics plus the on-demand `wikiLinks.scanWorkspace` command, which reads unopened files from disk via `workspace.fs` as UTF-8, builds ranges with `core/textPosition`, and keeps scanned results until the next scan or the file is deleted/renamed — VSCode file events plus a delete-only `FileSystemWatcher` for external deletes), `decorations` (resolution-based editor coloring), `previewResolver`. May import `vscode` and `src/core/**`.
- `src/markdownItPlugin/**` — the wiki plugin contributed to the Markdown preview via `contributes["markdown.markdownItPlugins"]`. Rewrites `[[...]]` into navigable links and expands `![[...]]` embeds. VSCode reuses the contributed markdown-it instance for source-editor analyses too (document highlights, smart-select, symbol mapping), so the rule **gates on `state.env` having a preview marker** (`containingImages` / `currentDocument` / `resourceProvider`) before touching `state.src` — otherwise rewritten ranges leak back to the source editor as bogus decorations. VSCode tokenizes the preview by string, so a core rule cannot read the previewed file path directly; the extension supplies it via `getDocumentPath` (backed by `vscode.window.activeTextEditor`) to seed the embed-cycle guard. **No `vscode` imports** (runs in the preview process).
- `src/extension.ts` — composition root: activates, builds `IndexService`, wires providers.

Tests: `test/unit/` (pure-core, fast) and `test/e2e/` (real Extension Development Host). E2e tests must not import `src/**` internals — they drive features through VSCode's public command surface (`vscode.executeLinkProvider`, `executeHoverProvider`, `executeCompletionItemProvider`, `applyEdit` with `RenameFile`).

`samples/` is a human-readable demo workspace (a wiki-link handbook whose pages use the features they describe), excluded from the VSIX via `.vscodeignore` and opened by the `Run Extension (samples)` launch config. Its pages describe resolver/parser behavior, so a behavior change must update them like any other doc, and they are tested: `test/unit/samplesWorkspace.test.ts` resolves every sample link with the real core — both with `samples/` as the root and with the repository root (samples + `test/fixtures` + root files) as the root, so a sample name that collides with a fixture or root file fails the suite — and the `samples` e2e label asserts diagnostics appear only on the handbook's intentional demo links. Keep sample file names unique across the repository; they are Prettier-formatted (`format:check` covers them).

## Wiki-link syntax (authoritative spec)

The README is the user-facing source of truth. Two forms — **link** (`[[...]]`) and **embed** (`![[...]]`):

```
[[ target [#fragment] [|display] ]]
target    := file-name (no extension required) | empty (same-file fragment)
fragment  := heading text | "^" block-id
display   := arbitrary text shown in place of the rendered link
```

Resolution rules that aren't obvious from the syntax alone:

- **Bare vs slashed targets resolve differently.** A bare `[[foo]]` uses unique base-name match; on ambiguity it prefers a single workspace-root-level match, else does a closest-parent ancestor walk (bounded to the workspace root). A slashed `[[a/b]]` uses unique global suffix match — **no walk**; ambiguous suffix → unresolved.
- **`..` segments and absolute paths are rejected** by the resolver.
- **Supported file extensions:** `.md` and `.markdown` for Markdown targets. Image media (png/jpg/jpeg/gif/webp/svg) resolves as both link and embed targets — a plain `[[image.png]]` link hover-previews the image, `![[image.png]]` embeds it.
- **Rename rewriting is resolution-verified.** `rewriteWikiRefs` re-resolves every ref from its post-rename location against the post-rename ("effective") index and rewrites exactly when resolution would change: targets that moved, refs inside moved files whose ancestor-walk anchor changed, and refs an incoming rename would make ambiguous. Refs that still resolve to the same file (case/extension variants included) are never touched. `buildRenameContext` precomputes the effective snapshot once per workspace root.
- **YAML frontmatter is excluded.** Wiki-links inside a leading `---` block are not rewritten on rename, and frontmatter is stripped from embed/hover previews (`core/frontmatter.ts`).
- **Index excludes vendor/VCS folders.** `core/pathFilter.ts` keeps files in `.git`, `node_modules`, etc. out of the index; the folder list is configurable via `wikiLinks.index.excludeFolders`. Rename link-rewriting scans with the same exclude list, so files in excluded folders are neither rewritten nor treated as link targets.
- **Block IDs** (`^block-id`) are defined by suffixing a paragraph (`text ^id`) or, for lists/quotes, placing `^id` on a line _after_ the block. Both forms are recognized.
- **Same-file fragment**: `[[#Heading]]` (empty target) links within the current file.
- **Embed-only modifier**: `![[image.png|300]]` — for embeds the `|...` segment is a width/size hint, not display text. The link and embed parsers are deliberately separate (`linkParser.ts` vs `embedParser.ts`) — do not unify them.

## Conventions

- `src/core/**` is pure: no I/O, no globals. Adapters do the I/O and pass data in.
- Unit tests pin **contract fields** (what consumers read), not full return shapes. Stateful/branching modules also get input→output logic-path tests.
- E2e tests assert user-observable behavior only (active editor, document text, hover content, link targets) — no internal imports, no regex/AST inspection, no preview-HTML scraping.
- **Unit fixtures must be platform-neutral.** `src/core/**` navigates paths with Node's platform `path`, so a hardcoded POSIX literal (`/root/a/b.md`) describes nothing on Windows and every bare-name resolution fails. Write fixture paths POSIX-style and pass them through `np()` (`test/helpers/nativePath.ts`), which converts to native separators; wrap asserted `fsPath` values too. Wiki-link text (targets, `insertText`, descriptions) is always forward-slash and stays literal.
- **Line endings are LF everywhere**, pinned by `.gitattributes` (`* text=auto eol=lf`). `.prettierrc` sets `endOfLine: "lf"`, so a CRLF checkout fails `format:check` on every file. Binary fixtures are pinned `binary` — the embeds PNG contains a `0D 0A` byte pair.
- Security: hot paths use `isInsideWorkspaceReal`/`RealSync` (realpath-based) for the workspace-boundary check; embed output is HTML/markdown-escaped; rename refuses filenames that would break `[[...]]` syntax; rename is gated on workspace trust.
- TDD: write the failing test, implement, commit per task.
- **Docs stay in sync with code.** Any code change must update the docs that describe it in the same commit: `README.md` (user-facing features + the Configuration table), this file (architecture, module list, spec/resolution rules), and `package.json` `contributes` descriptions. A setting declared in `package.json` that no code reads is a doc/code mismatch — wire it or remove it.

## Review step

Before completing a task or committing, **dispatch a subagent** to review the change against **every** convention above. Use a fresh subagent (e.g. the `Explore`/general-purpose agent) rather than reviewing inline — it reads the diff without the author's assumptions and is less likely to wave through a convention it never considered. Give it the diff (or the list of changed files) and this checklist; have it report pass/fail per item with specifics. Address what it flags before committing.

The subagent confirms:

- `src/core/**` stayed pure; layering (`no-restricted-imports`) is intact.
- New/changed pure modules have contract-field unit tests; branching logic has logic-path tests.
- E2e additions assert only user-observable behavior.
- Security invariants hold for any new path-, embed-, or rename-related code.
- **SOLID:** each module/class has one responsibility; design modules to be extensible — loose coupling, high cohesion; adapters depend on `src/core/**` abstractions, never the reverse; interfaces stay small and consumer-shaped (unit tests pin only contract fields); the link and embed parsers stay separate.
- **Performance:** providers run on the editing hot path — no work that scales worse than linear in document size per keystroke; build the fence mask once and share it; debounce change-driven work; read file headers, not whole files, when only a prefix is needed; bound caches and the index; do not block on I/O the user is not waiting for.
- Each task was TDD'd and committed on its own.
- Docs (README, CLAUDE.md, `package.json`) match the new behavior.
- `pnpm test` passes (format, lint, build, compile, unit, e2e).
