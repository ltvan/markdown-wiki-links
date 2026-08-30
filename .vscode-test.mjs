import { defineConfig } from '@vscode/test-cli';

const launchArgs = ['--disable-workspace-trust'];

export default defineConfig([
  {
    label: 'unique',
    files:
      'out/test/e2e/{smoke,documentLinks,hover,contribution,completion,excludeFolders}.test.js',
    workspaceFolder: 'test/fixtures/unique-names',
    launchArgs,
    mocha: { ui: 'tdd', timeout: 20000 },
  },
  {
    label: 'ambiguous',
    files: 'out/test/e2e/{ambiguous,diagnostics,completionDescription,scanWorkspace}.test.js',
    workspaceFolder: 'test/fixtures/ambiguous-names',
    launchArgs,
    mocha: { ui: 'tdd', timeout: 20000 },
  },
  {
    label: 'boundary',
    files: 'out/test/e2e/boundary.test.js',
    workspaceFolder: 'test/fixtures/boundary',
    launchArgs,
    mocha: { ui: 'tdd', timeout: 20000 },
  },
  {
    label: 'renames',
    files: 'out/test/e2e/rename.test.js',
    workspaceFolder: 'test/fixtures/renames',
    launchArgs,
    mocha: { ui: 'tdd', timeout: 20000 },
  },
  {
    label: 'multiroot',
    files: 'out/test/e2e/crossRoot.test.js',
    workspaceFolder: 'test/fixtures/multiroot/multiroot.code-workspace',
    launchArgs,
    mocha: { ui: 'tdd', timeout: 20000 },
  },
  {
    label: 'fragments',
    files: 'out/test/e2e/fragments.test.js',
    workspaceFolder: 'test/fixtures/headings-and-blocks',
    launchArgs,
    mocha: { ui: 'tdd', timeout: 20000 },
  },
  {
    label: 'embeds',
    files: 'out/test/e2e/embeds.test.js',
    workspaceFolder: 'test/fixtures/embeds',
    launchArgs,
    mocha: { ui: 'tdd', timeout: 20000 },
  },
  {
    label: 'samples',
    files: 'out/test/e2e/samples.test.js',
    workspaceFolder: 'samples',
    launchArgs,
    mocha: { ui: 'tdd', timeout: 20000 },
  },
]);
