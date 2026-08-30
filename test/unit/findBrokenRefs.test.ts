import * as assert from 'assert';

import { findBrokenRefs } from '../../src/core/diagnostics/findBrokenRefs';
import { createSnapshot, makeIndexEntry } from '../../src/core/resolver/resolveTarget';
import { np } from '../helpers/nativePath';

function snapshot(paths: string[]) {
  const root = np('/root');
  return createSnapshot(
    paths.map((p) => makeIndexEntry(np(p), root)),
    root,
  );
}

suite('findBrokenRefs', () => {
  const from = np('/root/notes/source.md');

  test('a link whose target does not exist is reported with its source range', () => {
    const text = 'See [[ghost]] here';
    const broken = findBrokenRefs(text, from, snapshot(['/root/notes/source.md']));
    assert.strictEqual(broken.length, 1);
    assert.strictEqual(broken[0].target, 'ghost');
    assert.strictEqual(text.slice(broken[0].range.start, broken[0].range.end), '[[ghost]]');
  });

  test('a link that resolves is not reported', () => {
    const broken = findBrokenRefs(
      'See [[alpha]]',
      from,
      snapshot(['/root/notes/source.md', '/root/a/alpha.md']),
    );
    assert.deepStrictEqual(broken, []);
  });

  test('an ambiguous bare link is reported', () => {
    const broken = findBrokenRefs(
      'See [[dup]]',
      from,
      snapshot(['/root/notes/source.md', '/root/a/dup.md', '/root/b/dup.md']),
    );
    assert.strictEqual(broken.length, 1);
  });

  test('a same-file [[#fragment]] link is never reported', () => {
    const broken = findBrokenRefs('[[#Heading]]', from, snapshot(['/root/notes/source.md']));
    assert.deepStrictEqual(broken, []);
  });

  test('links inside fenced code are ignored', () => {
    const broken = findBrokenRefs(
      '```\n[[ghost]]\n```\n`[[ghost]]`',
      from,
      snapshot(['/root/notes/source.md']),
    );
    assert.deepStrictEqual(broken, []);
  });

  test('every broken link in a document is reported, in document order', () => {
    const text = '[[one]] [[alpha]] [[two]]';
    const broken = findBrokenRefs(
      text,
      from,
      snapshot(['/root/notes/source.md', '/root/alpha.md']),
    );
    assert.deepStrictEqual(
      broken.map((r) => r.target),
      ['one', 'two'],
    );
  });
});
