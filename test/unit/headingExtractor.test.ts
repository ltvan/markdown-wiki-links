import * as assert from 'assert';

import { extractHeadings, slugify } from '../../src/core/blocks/headingExtractor';

suite('headingExtractor', () => {
  test('extracts ATX headings with line numbers', () => {
    const text = '# A\nbody\n## B C\n### D';
    const hs = extractHeadings(text);
    assert.deepStrictEqual(
      hs.map((h) => [h.text, h.line]),
      [
        ['A', 0],
        ['B C', 2],
        ['D', 3],
      ],
    );
  });
  test('captures heading level from the number of leading # characters', () => {
    const text = '# One\n## Two\n### Three\n###### Six';
    assert.deepStrictEqual(
      extractHeadings(text).map((h) => [h.text, h.level]),
      [
        ['One', 1],
        ['Two', 2],
        ['Three', 3],
        ['Six', 6],
      ],
    );
  });
  test('a footnote reference is stripped from the heading text and slug', () => {
    const [h] = extractHeadings('## Setup[^1]');
    assert.strictEqual(h.text, 'Setup');
    assert.strictEqual(h.slug, 'setup');
  });
  test('skips headings inside fences', () => {
    const text = '# real\n```\n# fake\n```';
    assert.strictEqual(extractHeadings(text).length, 1);
  });
  test('slug lowercases and hyphenates', () => {
    assert.strictEqual(slugify('My Heading'), 'my-heading');
  });
  test('collapses multiple spaces into single hyphens', () => {
    assert.strictEqual(slugify('Hello   World'), 'hello-world');
  });
  test('strips leading/trailing whitespace', () => {
    assert.strictEqual(slugify('  Trimmed  '), 'trimmed');
  });
  test('strips punctuation but keeps letters/digits/hyphen', () => {
    assert.strictEqual(slugify("Bob's House (2024)"), 'bobs-house-2024');
  });
  test('preserves Unicode letters', () => {
    assert.strictEqual(slugify('Café São Paulo'), 'café-são-paulo');
  });
});
