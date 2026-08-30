import * as assert from 'assert';

import { buildFenceMask } from '../../src/core/fenceMask';
import {
  stripFootnoteRefs,
  extractFootnoteDefs,
  footnoteRefAt,
  footnoteDefAt,
  footnoteRefsFor,
} from '../../src/core/footnote';

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
    const text = 'Body.[^1]\n\n[^1]: The footnote text.\n';
    const def = extractFootnoteDefs(text).get('1');
    assert.strictEqual(def?.line, 2);
    assert.strictEqual(def?.text, 'The footnote text.');
    assert.strictEqual(text.slice(def!.range.start, def!.range.end), '[^1]');
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
    const text = lines.join('\r\n');
    const defs = extractFootnoteDefs(text);
    assert.strictEqual(defs.get('1')?.line, 6);
    assert.strictEqual(defs.get('1')?.text, 'The note.');
    assert.strictEqual(text.slice(defs.get('1')!.range.start, defs.get('1')!.range.end), '[^1]');
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

suite('footnoteDefAt', () => {
  const text = 'See[^a] and [^a] again.\n\n[^a]: The note.\n[^b]: Other.';
  test('returns the definition whose [^label] contains the offset, with the label range', () => {
    const at = text.indexOf('[^a]: The note.');
    const def = footnoteDefAt(text, at + 1);
    assert.strictEqual(def?.line, 2);
    assert.strictEqual(def?.label, 'a');
    assert.strictEqual(text.slice(def!.range.start, def!.range.end), '[^a]');
  });
  test('only the [^label] token counts — the footnote body belongs to other providers', () => {
    assert.strictEqual(footnoteDefAt(text, text.indexOf('The note.') + 3), undefined);
    const withLink = '[^1]: see [Setup](#setup) here';
    assert.strictEqual(footnoteDefAt(withLink, withLink.indexOf('#setup')), undefined);
    assert.strictEqual(footnoteDefAt(withLink, 0)?.label, '1');
    assert.strictEqual(footnoteDefAt(withLink, 4)?.label, '1'); // just after "]", like refs
    assert.strictEqual(footnoteDefAt(withLink, 5), undefined);
  });
  test('a reference is not a definition', () => {
    assert.strictEqual(footnoteDefAt(text, 4), undefined);
  });
  test('definitions inside fenced code are ignored', () => {
    assert.strictEqual(footnoteDefAt('```\n[^x]: no\n```', 6), undefined);
  });
  test('a later definition is found past earlier ones', () => {
    const at = text.indexOf('[^b]: Other.') + 2;
    assert.strictEqual(footnoteDefAt(text, at)?.label, 'b');
    assert.strictEqual(footnoteDefAt(text, at)?.text, 'Other.');
  });
  test('duplicate labels: the map keeps the last definition, the token lookup finds each', () => {
    const dup = 'x[^d]\n\n[^d]: first\n\n[^d]: second';
    assert.strictEqual(extractFootnoteDefs(dup).get('d')?.text, 'second');
    assert.strictEqual(footnoteDefAt(dup, dup.indexOf('[^d]: first') + 1)?.text, 'first');
    assert.strictEqual(footnoteDefAt(dup, dup.indexOf('[^d]: second') + 1)?.text, 'second');
  });
  test('CRLF line endings and up to three spaces of indent keep the token range exact', () => {
    const text = 'see[^a]\r\n\r\n   [^a]: note\r\n';
    const def = footnoteDefAt(text, text.indexOf('[^a]:') + 2);
    assert.strictEqual(def?.label, 'a');
    assert.strictEqual(text.slice(def!.range.start, def!.range.end), '[^a]');
  });
});

suite('footnoteRefsFor', () => {
  const text = 'See[^a] and [^a] again, plus [^b].\n\n[^a]: The note.';
  test('lists every reference to the label in document order, excluding the definition', () => {
    const refs = footnoteRefsFor(text, 'a');
    assert.deepStrictEqual(
      refs.map((r) => text.slice(r.range.start, r.range.end)),
      ['[^a]', '[^a]'],
    );
    assert.ok(refs.every((r) => r.range.start < text.indexOf('[^a]: The note.')));
  });
  test('an unreferenced label yields no references', () => {
    assert.deepStrictEqual(footnoteRefsFor(text, 'zzz'), []);
  });
  test('references inside code are ignored', () => {
    assert.strictEqual(footnoteRefsFor('`[^a]` [^a]', 'a').length, 1);
  });
});
