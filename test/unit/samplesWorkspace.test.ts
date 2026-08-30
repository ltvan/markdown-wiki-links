import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import {
  createSnapshot,
  makeIndexEntry,
  resolveTarget,
} from '../../src/core/resolver/resolveTarget';
import { parseLinks } from '../../src/core/parser/linkParser';
import { parseEmbeds } from '../../src/core/parser/embedParser';
import { lineForFragment } from '../../src/core/blocks/sectionSlice';
import { buildFenceMask } from '../../src/core/fenceMask';
import { isExcludedPath } from '../../src/core/pathFilter';

// The samples/ handbook is documentation that must stay correct as the resolver evolves, and
// developers usually open the REPOSITORY root (not samples/) in VSCode, so its links are also
// resolved against the test fixtures. A sample file whose base name collides with a fixture
// (or a root-level file) becomes ambiguous or resolves outside samples/ in that setup.

const repoRoot = path.resolve(__dirname, '..', '..', '..');
const samplesDir = path.join(repoRoot, 'samples');
const fixturesDir = path.join(repoRoot, 'test', 'fixtures');

const INDEXABLE = /\.(md|markdown|png|jpe?g|gif|webp|svg)$/i;

// The extension's default `wikiLinks.index.excludeFolders`, read from the manifest so the test
// indexes exactly what the extension would when the repository root is the workspace.
const EXCLUDED_FOLDERS: string[] = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'),
).contributes.configuration.properties['wikiLinks.index.excludeFolders'].default;

// Machine-local, gitignored build output. The extension WOULD index these if present (they
// are not in the default exclude list), but their contents vary per machine and `.vscode-test`
// alone holds thousands of files, so they are skipped here for speed and determinism.
const BUILD_OUTPUT = new Set(['.vscode-test', 'out', 'dist']);

// Links the handbook leaves unresolved ON PURPOSE to demonstrate ambiguity and broken links.
const INTENTIONALLY_UNRESOLVED = new Set([
  'guide/resolution.md → meeting-notes',
  'guide/resolution.md → no-such-note',
  'guide/markdown-style.md → meeting-notes',
]);

// Every file the extension would index under `root`, using its own exclude filter.
function walk(root: string, dir: string = root): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (BUILD_OUTPUT.has(e.name) || isExcludedPath(path.relative(root, p), EXCLUDED_FOLDERS)) {
        return [];
      }
      return walk(root, p);
    }
    return INDEXABLE.test(e.name) ? [p] : [];
  });
}

type Problem = string;

function checkSamples(workspaceRoot: string, indexedFiles: string[]): Problem[] {
  const idx = createSnapshot(
    indexedFiles.map((f) => makeIndexEntry(f, workspaceRoot)),
    workspaceRoot,
  );
  const problems: Problem[] = [];
  for (const file of walk(samplesDir).filter((f) => /\.md$/i.test(f))) {
    const text = fs.readFileSync(file, 'utf8');
    const rel = path.relative(samplesDir, file).split(path.sep).join('/');
    const mask = buildFenceMask(text);
    for (const ref of [...parseLinks(text, mask), ...parseEmbeds(text, mask)]) {
      const key = `${rel} → ${ref.target}`;
      const resolved = resolveTarget(ref, file, idx);
      if (INTENTIONALLY_UNRESOLVED.has(key)) {
        if (resolved) problems.push(`${key}: expected to stay unresolved`);
        continue;
      }
      if (!resolved) {
        problems.push(`${key}: unresolved`);
        continue;
      }
      if (!resolved.fsPath.startsWith(samplesDir + path.sep)) {
        problems.push(
          `${key}: resolved outside samples/ (${path.relative(repoRoot, resolved.fsPath)})`,
        );
        continue;
      }
      if (ref.fragment && /\.(md|markdown)$/i.test(resolved.fsPath)) {
        const targetText = fs.readFileSync(resolved.fsPath, 'utf8');
        if (lineForFragment(ref.fragment, targetText) === undefined) {
          problems.push(`${key}#${ref.fragment}: fragment not found in target`);
        }
      }
    }
  }
  return problems;
}

suite('samples/ handbook links', () => {
  test('resolve inside samples/ when samples/ is the workspace', () => {
    assert.deepStrictEqual(checkSamples(samplesDir, walk(samplesDir)), []);
  });

  test('resolve inside samples/ when the repository root (with test fixtures) is the workspace', () => {
    const indexed = walk(repoRoot);
    // Sanity: the scenario really contains the fixtures the samples could collide with.
    assert.ok(
      indexed.some((f) => f.startsWith(fixturesDir + path.sep)),
      'fixtures not indexed',
    );
    assert.deepStrictEqual(checkSamples(repoRoot, indexed), []);
  });

  test('the intentional demo failures are all present in the handbook', () => {
    const seen = new Set<string>();
    for (const file of walk(samplesDir).filter((f) => /\.md$/i.test(f))) {
      const rel = path.relative(samplesDir, file).split(path.sep).join('/');
      for (const ref of parseLinks(fs.readFileSync(file, 'utf8')))
        seen.add(`${rel} → ${ref.target}`);
    }
    for (const key of INTENTIONALLY_UNRESOLVED)
      assert.ok(seen.has(key), `missing demo link ${key}`);
  });
});
