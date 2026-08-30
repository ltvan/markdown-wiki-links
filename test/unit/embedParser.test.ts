import * as assert from 'assert';

import { parseEmbeds } from '../../src/core/parser/embedParser';

suite('embedParser', () => {
  test('plain embed', () => {
    const [r] = parseEmbeds('![[note]]');
    assert.strictEqual(r.target, 'note');
    assert.strictEqual(r.kind, 'embed');
  });
  test('embed with heading', () => {
    const [r] = parseEmbeds('![[note#Section]]');
    assert.strictEqual(r.fragment, 'Section');
  });
  test('image with size hint stays as sizeHint, NOT display', () => {
    const [r] = parseEmbeds('![[diagram.png|300]]');
    assert.strictEqual(r.target, 'diagram.png');
    assert.strictEqual(r.sizeHint, '300');
    assert.strictEqual(r.display, undefined);
  });
  test('a paired [..] inside an embed fragment is plain text', () => {
    const [ref] = parseEmbeds('![[note#Edge cases [brackets]]]');
    assert.strictEqual(ref.fragment, 'Edge cases [brackets]');
  });
  test('does not match plain [[link]]', () => {
    assert.strictEqual(parseEmbeds('[[note]]').length, 0);
  });
  test('skips inside fence', () => {
    assert.strictEqual(parseEmbeds('```\n![[x]]\n```').length, 0);
  });
});
