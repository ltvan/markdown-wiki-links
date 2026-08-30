import * as assert from 'assert';

import { footnoteTargetId, tooltipTitle } from '../../src/previewScript/footnoteHover';

// The preview script's DOM wiring is thin; its decisions are pure and pinned here.
suite('preview footnote hover — pure helpers', () => {
  test('a footnote reference anchor points at the footnote body id', () => {
    assert.strictEqual(footnoteTargetId('#fn1'), 'fn1');
    assert.strictEqual(footnoteTargetId('#fn12'), 'fn12');
  });
  test('the back-reference anchor inside a footnote body is not a reference', () => {
    assert.strictEqual(footnoteTargetId('#fnref1'), undefined);
  });
  test('other in-page anchors and external links are ignored', () => {
    assert.strictEqual(footnoteTargetId('#setup'), undefined);
    assert.strictEqual(footnoteTargetId('https://example.com/#fn1'), undefined);
    assert.strictEqual(footnoteTargetId(null), undefined);
  });
  test('the tooltip title names the footnote number or label', () => {
    assert.strictEqual(tooltipTitle('fn1'), 'Footnote 1');
  });
});
