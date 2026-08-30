import * as assert from 'assert';

import { buildFenceMask } from '../../src/core/fenceMask';
import { stripFootnoteRefs, extractFootnoteDefs, footnoteRefAt } from '../../src/core/footnote';

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

suite('extractFootnoteDefs', () => {
  test('a one-line definition maps its label to the text and line', () => {
    const defs = extractFootnoteDefs('Body.[^1]\n\n[^1]: The footnote text.\n');
    assert.deepStrictEqual(defs.get('1'), { line: 2, text: 'The footnote text.' });
  });
  test('indented continuation lines belong to the definition, dedented', () => {
    const text = '[^a]: First line.\n    Second line.\n\n    Third paragraph.\n\nNot part of it.';
    assert.strictEqual(
      extractFootnoteDefs(text).get('a')?.text,
      'First line.\nSecond line.\n\nThird paragraph.',
    );
  });
  test('an unindented non-blank line right after the definition is a lazy continuation', () => {
    const text = '[^a]: First line.\nstill the footnote\n\nNew paragraph.';
    assert.strictEqual(extractFootnoteDefs(text).get('a')?.text, 'First line.\nstill the footnote');
  });
  test('named labels and several definitions are all collected', () => {
    const defs = extractFootnoteDefs('[^one]: One.\n[^two-b]: Two.\n');
    assert.deepStrictEqual([...defs.keys()], ['one', 'two-b']);
  });
  test('CRLF documents: definitions after a fence are found and fenced ones still ignored', () => {
    // Fence-mask offsets are computed on the raw text; splitting on /\r?\n/ would drift one
    // character per line and mis-classify every line after the first CRLF.
    const lines = [
      '# T',
      '',
      '```',
      'x',
      '```',
      '',
      '[^1]: The note.',
      '',
      '```',
      '[^2]: in code',
      '```',
    ];
    const defs = extractFootnoteDefs(lines.join('\r\n'));
    assert.deepStrictEqual(defs.get('1'), { line: 6, text: 'The note.' });
    assert.strictEqual(defs.get('2'), undefined);
  });
  test('lazy continuation stops at a block start: list, quote, thematic break, html', () => {
    assert.strictEqual(extractFootnoteDefs('[^a]: a\n- item').get('a')?.text, 'a');
    assert.strictEqual(extractFootnoteDefs('[^b]: b\n> quote').get('b')?.text, 'b');
    assert.strictEqual(extractFootnoteDefs('[^c]: c\n---').get('c')?.text, 'c');
    assert.strictEqual(extractFootnoteDefs('[^d]: d\n<div>').get('d')?.text, 'd');
    assert.strictEqual(extractFootnoteDefs('[^e]: e\n1. step').get('e')?.text, 'e');
  });
  test('a shared fence mask can be passed in by the caller', () => {
    const text = 'x[^1]\n\n[^1]: Def.';
    const mask = buildFenceMask(text);
    assert.strictEqual(footnoteRefAt(text, 2, mask)?.label, '1');
    assert.strictEqual(extractFootnoteDefs(text, mask).get('1')?.text, 'Def.');
  });
  test('definitions inside fenced code are ignored', () => {
    assert.strictEqual(extractFootnoteDefs('```\n[^1]: nope\n```\n').size, 0);
  });
  test('a reference is not a definition', () => {
    assert.strictEqual(extractFootnoteDefs('See [^1] here.').size, 0);
  });
});

suite('footnoteRefAt', () => {
  const text = 'Setup[^1] and more[^two]\n\n[^1]: Def.';
  test('returns the reference under the offset with its source range', () => {
    const ref = footnoteRefAt(text, 6);
    assert.strictEqual(ref?.label, '1');
    assert.strictEqual(text.slice(ref!.range.start, ref!.range.end), '[^1]');
  });
  test('the range is inclusive of both bracket ends', () => {
    assert.strictEqual(footnoteRefAt(text, 5)?.label, '1');
    assert.strictEqual(footnoteRefAt(text, 9)?.label, '1');
    assert.strictEqual(footnoteRefAt(text, 4), undefined);
  });
  test('finds a later named reference', () => {
    assert.strictEqual(footnoteRefAt(text, 20)?.label, 'two');
  });
  test('the label of a definition line is not a reference', () => {
    assert.strictEqual(footnoteRefAt(text, 28), undefined);
  });
  test('references inside code are ignored', () => {
    assert.strictEqual(footnoteRefAt('`[^1]`', 2), undefined);
  });
});
