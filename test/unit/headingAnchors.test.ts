import * as assert from 'assert';

import MarkdownIt from 'markdown-it';
import footnote from 'markdown-it-footnote';

import { previewHeadingAnchors, githubSlugify } from '../../src/markdownItPlugin/headingAnchors';

// VSCode's preview assigns each heading an id by slugging the concatenated text of the
// heading's inline tokens. Which tokens exist depends on the plugins loaded into the shared
// markdown-it instance — a footnote plugin (bierner.markdown-footnotes) turns "[^1]" into a
// footnote_ref token with no text. Anchors are therefore computed with the live instance.
const plain = (): MarkdownIt => new MarkdownIt();
const withFootnotes = (): MarkdownIt => new MarkdownIt().use(footnote);

const doc = '# Top\n\n## Setup[^1]\n\nbody\n\n[^1]: The footnote.\n';

suite('previewHeadingAnchors', () => {
  test('without a footnote plugin the marker is text and part of the id', () => {
    assert.strictEqual(previewHeadingAnchors(plain(), doc).get(2), 'setup1');
  });
  test('with markdown-it-footnote the marker carries no text, so the id is the clean slug', () => {
    assert.strictEqual(previewHeadingAnchors(withFootnotes(), doc).get(2), 'setup');
  });
  test('with the plugin, a reference without a definition stays literal text', () => {
    const undefinedRef = '## Setup[^nope]\n';
    assert.strictEqual(previewHeadingAnchors(withFootnotes(), undefinedRef).get(0), 'setupnope');
  });
  test('ids are keyed by the heading line and cover every heading', () => {
    const anchors = previewHeadingAnchors(plain(), doc);
    assert.deepStrictEqual(
      [...anchors],
      [
        [0, 'top'],
        [2, 'setup1'],
      ],
    );
  });
  test('duplicate headings get -1, -2 suffixes like VSCode', () => {
    const anchors = previewHeadingAnchors(plain(), '# A\n# A\n# A\n');
    assert.deepStrictEqual([...anchors.values()], ['a', 'a-1', 'a-2']);
  });
  test('inline markup contributes only its text (a link in a heading)', () => {
    assert.strictEqual(previewHeadingAnchors(plain(), '## [Setup](x.md)').get(0), 'setup');
  });
  test('inline HTML in a heading contributes no text (VSCode keeps text, code, emoji only)', () => {
    const md = new MarkdownIt({ html: true });
    assert.strictEqual(previewHeadingAnchors(md, '## Foo <b>bar</b>').get(0), 'foo-bar');
    assert.strictEqual(
      previewHeadingAnchors(md, '## Run `npm test` now').get(0),
      'run-npm-test-now',
    );
  });
  test('headings inside fenced code are not anchors', () => {
    assert.deepStrictEqual(
      [...previewHeadingAnchors(plain(), '```\n# not\n```\n# yes')],
      [[3, 'yes']],
    );
  });
});

suite('githubSlugify (VSCode preview slug rules)', () => {
  // Pinned against VSCode's current markdown-language-features slugifier: lowercase, drop
  // Unicode punctuation/symbols/controls, then every whitespace character becomes "-". No
  // percent-encoding and no hyphen trimming (that was an older algorithm).
  test('lowercases, hyphenates whitespace, strips punctuation, keeps underscores', () => {
    assert.strictEqual(githubSlugify('Hello, World_1!'), 'hello-world_1');
  });
  test('keeps non-ASCII letters as they are', () => {
    assert.strictEqual(githubSlugify('Ünïcode'), 'ünïcode');
    assert.strictEqual(githubSlugify('Tiêu đề'), 'tiêu-đề');
  });
  test('every whitespace character becomes its own hyphen; leading/trailing hyphens stay', () => {
    assert.strictEqual(githubSlugify('A  B'), 'a--b');
    assert.strictEqual(githubSlugify('--x--'), '--x--');
  });
  test('letter-like numbers and symbols (Alphabetic) survive; other numbers do not', () => {
    // github-slugger's class keeps the Alphabetic property, not just General_Category L:
    // Roman numerals (Nl) and circled letters (So + Other_Alphabetic) are kept, superscripts
    // (No) are dropped.
    assert.strictEqual(githubSlugify('Part Ⅱ'), 'part-ⅱ');
    assert.strictEqual(githubSlugify('Ⓐ option'), 'ⓐ-option');
    assert.strictEqual(githubSlugify('x²'), 'x');
  });
  test('Unicode punctuation and control characters are dropped', () => {
    assert.strictEqual(githubSlugify('a–b'), 'ab');
    assert.strictEqual(githubSlugify('x\ty'), 'xy');
  });
});
