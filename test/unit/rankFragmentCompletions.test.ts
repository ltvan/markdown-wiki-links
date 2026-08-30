import * as assert from 'assert';

import { rankFragmentCompletions } from '../../src/core/completion/rankFragmentCompletions';

suite('rankFragmentCompletions (contract)', () => {
  test('returns each heading as a candidate keyed to its text', () => {
    const text = '# Top\n\n## Intro\n\nbody\n\n## Details\n';
    const labels = rankFragmentCompletions(text).map((c) => c.label);
    assert.deepStrictEqual(labels, ['Top', 'Intro', 'Details']);
  });

  test('a footnoted heading is offered without its footnote reference', () => {
    const [c] = rankFragmentCompletions('## Setup[^1]\n\n[^1]: The footnote.');
    assert.strictEqual(c.label, 'Setup');
    assert.strictEqual(c.insertText, 'Setup');
  });
  test('block ids appear as ^id candidates', () => {
    const text = '# Top\n\nA paragraph. ^para-a';
    const cands = rankFragmentCompletions(text);
    assert.ok(
      cands.some((c) => c.label === '^para-a' && c.kind === 'block-id'),
      `expected ^para-a block-id candidate, got: ${cands.map((c) => c.label).join(', ')}`,
    );
  });

  test('insertText matches the label (heading text or ^id)', () => {
    const text = '# Heading One\n\nbody. ^marker';
    for (const c of rankFragmentCompletions(text)) {
      assert.strictEqual(c.insertText, c.label, `insertText must equal label for ${c.label}`);
    }
  });

  test('candidates carry their line number (1-indexed for human display)', () => {
    const text = '# Top\n\n## Intro\n';
    const intro = rankFragmentCompletions(text).find((c) => c.label === 'Intro');
    assert.strictEqual(intro?.line, 3, `expected line 3, got ${intro?.line}`);
  });

  test('heading candidates carry the heading level; block-ids do not', () => {
    const text = '# One\n## Two\n### Three\n\npara. ^marker';
    const cands = rankFragmentCompletions(text);
    const byLabel = new Map(cands.map((c) => [c.label, c]));
    assert.strictEqual(byLabel.get('One')?.level, 1);
    assert.strictEqual(byLabel.get('Two')?.level, 2);
    assert.strictEqual(byLabel.get('Three')?.level, 3);
    assert.strictEqual(byLabel.get('^marker')?.level, undefined);
  });

  test('candidates appear in document order (headings and block-ids interleaved)', () => {
    const text = '# One\npara A. ^a\n## Two\npara B. ^b\n### Three';
    const labels = rankFragmentCompletions(text).map((c) => c.label);
    assert.deepStrictEqual(labels, ['One', '^a', 'Two', '^b', 'Three']);
  });

  test('headings inside fenced code are excluded', () => {
    const text = '# Real\n\n```\n# Fake\n```\n';
    const labels = rankFragmentCompletions(text).map((c) => c.label);
    assert.deepStrictEqual(labels, ['Real']);
  });

  test('block ids inside fenced code are excluded', () => {
    const text = '# Top\n\n```\npara ^hidden\n```\n';
    const labels = rankFragmentCompletions(text).map((c) => c.label);
    assert.ok(
      !labels.some((l) => l === '^hidden'),
      `^hidden must not appear, got: ${labels.join(', ')}`,
    );
  });

  test('empty input yields no candidates', () => {
    assert.deepStrictEqual(rankFragmentCompletions(''), []);
  });
});
