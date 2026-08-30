import * as assert from 'assert';

import { stripFootnoteRefs } from '../../src/core/footnote';

suite('stripFootnoteRefs', () => {
  test('removes a trailing footnote reference', () => {
    assert.strictEqual(stripFootnoteRefs('Setup[^1]'), 'Setup');
  });
  test('removes named and multiple references, collapsing the gaps they leave', () => {
    assert.strictEqual(stripFootnoteRefs('A [^note-a] and B[^2] end'), 'A and B end');
  });
  test('leaves text without references unchanged', () => {
    assert.strictEqual(stripFootnoteRefs('Plain heading'), 'Plain heading');
  });
  test('does not touch ordinary links or bracketed text', () => {
    assert.strictEqual(stripFootnoteRefs('See [docs](x) and [note]'), 'See [docs](x) and [note]');
  });
  test('a caret with whitespace inside the brackets is not a footnote reference', () => {
    assert.strictEqual(stripFootnoteRefs('Keep [^ not one]'), 'Keep [^ not one]');
  });
});
