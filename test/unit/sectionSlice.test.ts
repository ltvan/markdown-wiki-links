import * as assert from 'assert';

import { lineForFragment, sliceSection } from '../../src/core/blocks/sectionSlice';

const sample =
  '# Top\n\n## Section One\n\nFirst body line.\nSecond body line. ^para-a\n\n## Section Two\nOther body.';

suite('sectionSlice (logic paths)', () => {
  test('lineForFragment finds a heading by exact text', () => {
    assert.strictEqual(lineForFragment('Section One', sample), 2);
  });
  test('lineForFragment finds a heading by slug', () => {
    assert.strictEqual(lineForFragment('section-one', sample), 2);
  });
  test('lineForFragment finds a block-id (caret prefix)', () => {
    assert.strictEqual(lineForFragment('^para-a', sample), 5);
  });
  test('lineForFragment matches a footnoted heading by its footnote-free text', () => {
    assert.strictEqual(lineForFragment('Setup', '# Top\n\n## Setup[^1]\n\nbody'), 2);
  });
  test('sliceSection matches a footnoted heading by its footnote-free text', () => {
    const out = sliceSection('Setup', '## Setup[^1]\n\nbody\n\n## Next');
    assert.strictEqual(out, '## Setup[^1]\n\nbody\n');
  });
  test('lineForFragment returns undefined for an unknown fragment', () => {
    assert.strictEqual(lineForFragment('Nope', sample), undefined);
  });
  test('sliceSection returns lines from the heading to (but not including) the next heading', () => {
    const sliced = sliceSection('Section One', sample);
    assert.ok(sliced.startsWith('## Section One'));
    assert.ok(sliced.includes('First body line.'));
    assert.ok(!sliced.includes('## Section Two'));
  });
  test('sliceSection for a block-id returns its paragraph up to the next blank line', () => {
    const sliced = sliceSection('^para-a', sample);
    assert.ok(sliced.includes('Second body line. ^para-a'));
    assert.ok(!sliced.includes('## Section Two'));
  });
});
