import * as assert from 'assert';

import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';

import { lineForFragment } from '../../src/core/blocks/sectionSlice';
import { wikiPlugin, WikiResolver } from '../../src/markdownItPlugin/wikiRule';

// A resolver where embeds resolve a small fixed set and links resolve to "<target>.md".
function resolver(over: Partial<WikiResolver> = {}): WikiResolver {
  return {
    resolveEmbed: (_from, key) => {
      if (key === 'note')
        return { kind: 'markdown', text: '# Note\n\nNote body.', sourcePath: '/abs/note.md' };
      if (key === 'note#Section')
        return {
          kind: 'markdown',
          text: '## Section\nSection body.',
          sourcePath: '/abs/note.md',
        };
      if (key === 'diagram.png') return { kind: 'image', src: 'media/diagram.png' };
      return null;
    },
    resolveLink: (_from, target) => (target === 'ghost' ? null : `${target}.md`),
    ...over,
  };
}

// Preview-shaped env (mirrors what VSCode's preview path passes). Non-preview render calls
// omit these fields so the wikiPlugin must no-op for them.
const previewEnv = (): Record<string, unknown> => ({ containingImages: new Set<string>() });

function mk(
  res: WikiResolver,
  opts: { maxDepth?: number; getDocumentPath?: () => string | undefined } = {},
): MarkdownIt {
  const md = new MarkdownIt({ html: true }).use(wikiPlugin, { resolver: res, ...opts });
  // Default every render to preview env so existing tests need no call-site change. Tests that
  // need to assert non-preview behaviour call md.render(src, {}) explicitly.
  const original = md.render.bind(md);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  md.render = (src: string, env?: any) => original(src, env ?? previewEnv());
  return md;
}

suite('wikiPlugin — embeds', () => {
  test('embeds full markdown file', () => {
    assert.ok(mk(resolver()).render('before\n\n![[note]]\n\nafter').includes('Note body.'));
  });
  test('embeds heading section', () => {
    assert.ok(mk(resolver()).render('![[note#Section]]').includes('Section body.'));
  });
  test('image embed produces an image referencing the resolved src', () => {
    const out = mk(resolver()).render('![[diagram.png]]');
    assert.ok(/<img\s[^>]*src="media\/diagram\.png"/.test(out), `got: ${out}`);
  });
  test('image embed with a width hint renders the image at that width', () => {
    const res = resolver({
      resolveEmbed: (_f, key) =>
        key.startsWith('diagram.png') ? { kind: 'image', src: 'media/diagram.png' } : null,
    });
    const out = mk(res).render('![[diagram.png|300]]');
    assert.ok(/<img\s[^>]*src="media\/diagram\.png"/.test(out), `got: ${out}`);
    assert.ok(/width="300"/.test(out), `expected width attribute, got: ${out}`);
    assert.ok(!out.includes('wl-size'), `size title must be stripped, got: ${out}`);
  });
  test('image embed with a width x height hint sets both dimensions', () => {
    const res = resolver({
      resolveEmbed: (_f, key) =>
        key.startsWith('diagram.png') ? { kind: 'image', src: 'media/diagram.png' } : null,
    });
    const out = mk(res).render('![[diagram.png|300x150]]');
    assert.ok(/width="300"/.test(out) && /height="150"/.test(out), `got: ${out}`);
  });
  test('unresolved embed leaves a placeholder, no crash', () => {
    const res = resolver({ resolveEmbed: () => null });
    assert.ok(mk(res).render('![[ghost]]').includes('ghost'));
  });
  test('depth cap stops recursion at the configured limit', () => {
    const res: WikiResolver = {
      resolveEmbed: (_f, key) => {
        const next = String.fromCharCode(key.charCodeAt(0) + 1);
        return {
          kind: 'markdown',
          text: `level-${key}. ![[${next}]]`,
          sourcePath: `/abs/${key}.md`,
        };
      },
      resolveLink: () => null,
    };
    assert.ok(/Embed depth exceeded/i.test(mk(res, { maxDepth: 2 }).render('![[a]]')));
  });
  test('ancestor cycle (a -> b -> a) is caught', () => {
    const res: WikiResolver = {
      resolveEmbed: (_f, key) => {
        if (key === 'a')
          return { kind: 'markdown', text: 'A body. ![[b]]', sourcePath: '/abs/a.md' };
        if (key === 'b')
          return { kind: 'markdown', text: 'B body. ![[a]]', sourcePath: '/abs/b.md' };
        return null;
      },
      resolveLink: () => null,
    };
    const out = mk(res, { maxDepth: 10 }).render('![[a]]');
    assert.ok(out.includes('A body.') && out.includes('B body.'));
    assert.ok(/Cyclic embed/i.test(out));
  });
  test('a file that embeds itself is caught at the first reference', () => {
    const res: WikiResolver = {
      resolveEmbed: (_f, key) =>
        key === 'self'
          ? { kind: 'markdown', text: 'Self body. ![[self]]', sourcePath: '/abs/self.md' }
          : null,
      resolveLink: () => null,
    };
    const out = mk(res, { maxDepth: 10, getDocumentPath: () => '/abs/self.md' }).render(
      'Doc body. ![[self]]',
    );
    assert.ok(/Cyclic embed/i.test(out), `expected cyclic marker, got: ${out}`);
    assert.ok(!out.includes('Self body.'), `self content must not expand even once, got: ${out}`);
  });
  test('an ![[note]] inside an inline code span is left as code, not expanded', () => {
    // Reproduces a Markdown file like: write `![[note]]` to embed the file.
    // Without fence-masking the wikiPlugin replaces the source BEFORE markdown-it sees the code
    // span, so "Note body." appears in the rendered output instead of a literal code span.
    const out = mk(resolver()).render('write `![[note]]` in your file');
    assert.ok(/<code>!\[\[note\]\]<\/code>/.test(out), `expected literal code span, got: ${out}`);
    assert.ok(!out.includes('Note body.'), `embed must not expand inside code, got: ${out}`);
  });
  test('an ![[note]] inside a fenced code block is left as code, not expanded', () => {
    const out = mk(resolver()).render('```\n![[note]]\n```');
    assert.ok(out.includes('![[note]]'), `expected literal text in fence, got: ${out}`);
    assert.ok(!out.includes('Note body.'), `embed must not expand inside fence, got: ${out}`);
  });
  test('depth-cap "Embed depth exceeded" marker is not written inside a fenced code block', () => {
    // Combines depth=0 + a masked occurrence: the cap branch also gates on the mask, so the
    // literal text in the fenced block must survive even when the recursion budget is gone.
    const res: WikiResolver = {
      resolveEmbed: () => null,
      resolveLink: () => null,
    };
    const out = mk(res, { maxDepth: 0 }).render('```\n![[note]]\n```');
    assert.ok(out.includes('![[note]]'), `expected literal in fence at depth=0, got: ${out}`);
    assert.ok(
      !out.includes('Embed depth exceeded'),
      `cap marker must not be inserted inside fence, got: ${out}`,
    );
  });
  test('indented (4-space) code blocks are NOT masked — current limitation', () => {
    // Pins today's behaviour: src/core/fenceMask.ts only recognises ``` / ~~~ fences and inline
    // backticks. Indented code blocks fall through, so [[foo]] is rewritten before markdown-it
    // wraps the line in <pre><code>; the rendered output contains the markdown link syntax
    // verbatim instead of the literal [[foo]] the user typed. If fenceMask gains indented-block
    // support, flip this assertion to expect the literal `[[foo]]` to survive.
    const out = mk(resolver()).render('    [[foo]]\n');
    assert.ok(
      out.includes('<pre><code>') && !out.includes('[[foo]]'),
      `today indented code blocks are not masked; got: ${out}`,
    );
  });
  test('image target with quote is HTML-attribute-escaped', () => {
    const res = resolver({ resolveEmbed: () => ({ kind: 'image', src: 'x.png' }) });
    const out = mk(res).render('![[evil".png]]');
    assert.ok(out.includes('&quot;'), `expected escaped quote, got: ${out}`);
  });
});

suite('wikiPlugin — links', () => {
  test('plain [[foo]] becomes a navigable link', () => {
    const out = mk(resolver()).render('see [[foo]] here');
    assert.ok(/<a [^>]*href="foo\.md"[^>]*>foo<\/a>/.test(out), `got: ${out}`);
  });
  test('[[foo|Display]] uses the display text as the link label', () => {
    const out = mk(resolver()).render('[[foo|Display]]');
    assert.ok(/>Display<\/a>/.test(out), `got: ${out}`);
    assert.ok(out.includes('href="foo.md"'));
  });
  test('unresolved [[ghost]] keeps its original text, not a link', () => {
    const out = mk(resolver()).render('[[ghost]]');
    assert.ok(out.includes('[[ghost]]'), `expected the source text verbatim: ${out}`);
    assert.ok(!/<a /.test(out), `should not be a link: ${out}`);
  });
  test('unresolved link with display text and fragment keeps the whole original text', () => {
    const out = mk(resolver()).render('[[ghost#Heading|Shown]]');
    assert.ok(out.includes('[[ghost#Heading|Shown]]'), `expected the source text verbatim: ${out}`);
    assert.ok(!/<a /.test(out), `should not be a link: ${out}`);
  });
  test('embeds are not also rewritten as links', () => {
    const out = mk(resolver()).render('![[note]]');
    assert.ok(out.includes('Note body.'));
    assert.ok(!out.includes('[[note]]'));
  });
  test('wiki-links inside YAML frontmatter are left verbatim', () => {
    const src = '---\ncover: "[[my_image.svg]]"\n---\n\nBody [[foo]].';
    const out = mk(resolver()).render(src);
    assert.ok(out.includes('[[my_image.svg]]'), `frontmatter must stay verbatim, got: ${out}`);
    assert.ok(/<a [^>]*href="foo\.md"/.test(out), `body link should be rewritten, got: ${out}`);
  });
  test('a [[foo]] inside an inline code span is left as code, not rewritten', () => {
    // markdown-it tokenizes inline code AFTER our preprocessor ran, so the wikiPlugin must
    // pre-skip ranges that are inside ``...``. Without fence-masking, the link expands inside
    // <code> and breaks the span.
    const out = mk(resolver()).render('write `[[foo]]` in your file');
    assert.ok(/<code>\[\[foo\]\]<\/code>/.test(out), `expected literal code span, got: ${out}`);
    assert.ok(!/<a [^>]*href="foo\.md"/.test(out), `must not become a link, got: ${out}`);
  });
  test('a [[foo]] inside a fenced code block is left as code, not rewritten', () => {
    const out = mk(resolver()).render('```\nuse [[foo]] like this\n```');
    assert.ok(out.includes('[[foo]]'), `expected literal text in fence, got: ${out}`);
    assert.ok(!/<a [^>]*href="foo\.md"/.test(out), `must not become a link, got: ${out}`);
  });
  test('does NOT rewrite when env lacks preview markers (source-mode analyses stay intact)', () => {
    // Reproduces the failure mode where VSCode reuses the contributed markdown-it instance for
    // source-editor analyses (document highlights, smart-select, symbol mapping). Those calls
    // do not pass `containingImages` / `currentDocument`; for them we must leave state.src as-is
    // so positions reported back to the source editor still line up.
    const md = new MarkdownIt({ html: true }).use(wikiPlugin, { resolver: resolver() });
    const src = 'see [[foo]] and ![[note]] here';
    const outNoEnv = md.render(src, {});
    // No link rewriting, no embed expansion — the literal source survives untouched.
    assert.ok(outNoEnv.includes('[[foo]]'), `expected literal [[foo]], got: ${outNoEnv}`);
    assert.ok(outNoEnv.includes('![[note]]'), `expected literal ![[note]], got: ${outNoEnv}`);
    assert.ok(!outNoEnv.includes('Note body.'), `embed must not expand, got: ${outNoEnv}`);
    // With preview env present, both should be processed (sanity check against the same instance).
    const outPreview = md.render(src, previewEnv());
    assert.ok(
      /<a [^>]*href="foo\.md"/.test(outPreview),
      `preview should rewrite, got: ${outPreview}`,
    );
    assert.ok(outPreview.includes('Note body.'), `preview should embed, got: ${outPreview}`);
  });
  test('links inside embedded content are also rewritten', () => {
    const res: WikiResolver = {
      resolveEmbed: (_f, key) =>
        key === 'note'
          ? { kind: 'markdown', text: 'Note links to [[other]].', sourcePath: '/abs/note.md' }
          : null,
      resolveLink: (_f, target) => `${target}.md`,
    };
    const out = mk(res).render('![[note]]');
    assert.ok(/<a [^>]*href="other\.md"/.test(out), `got: ${out}`);
  });
  test('a link AFTER an expanding embed is not wrongly skipped because of a code span elsewhere', () => {
    // Regression for the "random [[README]] stays plain text" bug. The fence mask used by
    // rewriteLinks must reflect the POST-embed source: embed bodies shift the offsets of every
    // [[link]] that follows, so a pre-embed mask interval (e.g. an inline code span far below)
    // can end up covering the new position of a perfectly fine link in the middle of the file.
    //
    // We make the trigger deterministic. ![[note]] is 9 chars; we expand it to a 100-char body
    // (shift = +91). [[Link]] starts at original offset 10 → post-embed offset 101. The original
    // source ends with `code`, whose backtick span sits at pre-embed offsets [99, 105). Pre-fix:
    // rewriteLinks would check isMasked(staleMask, 101) and skip the link. Post-fix: the mask is
    // rebuilt from the post-embed text, where the backticks live at a different offset.
    const noteBody = 'X'.repeat(100);
    const res: WikiResolver = {
      resolveEmbed: (_f, key) =>
        key === 'note' ? { kind: 'markdown', text: noteBody, sourcePath: '/abs/note.md' } : null,
      resolveLink: (_f, target) => `${target}.md`,
    };
    const src = '![[note]]\n[[Link]]\n' + '.'.repeat(80) + '`code`';
    const out = mk(res).render(src);
    assert.ok(
      /<a [^>]*href="Link\.md"/.test(out),
      `[[Link]] after an embed must still be rewritten; got: ${out}`,
    );
  });
});

suite('wikiPlugin — heading anchors (with and without a footnote plugin)', () => {
  const target = '# Top\n\n## Setup[^1]\n\nbody\n\n[^1]: The footnote.\n';
  const env = { currentDocument: 'x' };
  // A resolver that mimics the adapter: cross-file links ask the plugin for the target's
  // anchors (it owns the markdown-it instance) and append the one for the matched heading.
  const res: WikiResolver = {
    resolveEmbed: () => null,
    resolveLink: (_from, t, fragment, anchorsOf) => {
      if (t !== 'note') return null;
      const line = fragment ? lineForFragment(fragment, target) : undefined;
      const anchor = line === undefined ? undefined : anchorsOf(target).get(line);
      return anchor ? `note.md#${anchor}` : 'note.md';
    },
  };

  test('same-file [[#Setup]] uses the anchor of the previewed text — footnote marker as text', () => {
    const md = new MarkdownIt({ html: true }).use(wikiPlugin, { resolver: res });
    const out = md.render(target + '\n[[#Setup]]', env);
    assert.ok(out.includes('href="#setup1"'), out);
  });
  test('same-file [[#Setup]] with markdown-it-footnote loaded points at the clean id', () => {
    const md = new MarkdownIt({ html: true }).use(footnote).use(wikiPlugin, { resolver: res });
    const out = md.render(target + '\n[[#Setup]]', env);
    assert.ok(out.includes('href="#setup"'), out);
  });
  test('cross-file [[note#Setup]] gets the target anchor from the live instance', () => {
    const plain = new MarkdownIt({ html: true }).use(wikiPlugin, { resolver: res });
    assert.ok(plain.render('[[note#Setup]]', env).includes('href="note.md#setup1"'));
    const fn = new MarkdownIt({ html: true }).use(footnote).use(wikiPlugin, { resolver: res });
    assert.ok(fn.render('[[note#Setup]]', env).includes('href="note.md#setup"'));
  });
});
