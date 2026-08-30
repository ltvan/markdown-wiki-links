import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');
const common = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  external: ['vscode'],
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info',
};

const ctxs = await Promise.all([
  esbuild.context({ ...common, entryPoints: ['src/extension.ts'], outfile: 'dist/extension.js' }),
  esbuild.context({
    ...common,
    entryPoints: ['src/markdownItPlugin/index.ts'],
    outfile: 'dist/markdownItPlugin.js',
  }),
  // Runs inside the Markdown preview webview (contributes.markdown.previewScripts): a browser
  // IIFE, no Node, no vscode.
  esbuild.context({
    ...common,
    platform: 'browser',
    target: 'es2022',
    format: 'iife',
    external: [],
    entryPoints: ['src/previewScript/footnoteHover.ts'],
    outfile: 'dist/previewScript/footnoteHover.js',
  }),
]);

if (watch) {
  await Promise.all(ctxs.map((c) => c.watch()));
} else {
  for (const c of ctxs) {
    await c.rebuild();
    await c.dispose();
  }
}
