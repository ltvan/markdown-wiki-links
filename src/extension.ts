import * as vscode from 'vscode';

import { IndexService } from './adapters/indexService';
import { WikiDocumentLinkProvider } from './adapters/documentLinkProvider';
import { WikiHoverProvider } from './adapters/hoverProvider';
import { FootnoteHoverProvider } from './adapters/footnoteHoverProvider';
import { RenameHandler } from './adapters/renameHandler';
import { createPreviewResolver } from './adapters/previewResolver';
import { WikiDiagnostics } from './adapters/diagnostics';
import { WikiCompletionProvider } from './adapters/completionProvider';
import { WikiDecorations } from './adapters/decorations';
import {
  extendMarkdownIt as wireMarkdownIt,
  setResolver,
  resetResolver,
} from './markdownItPlugin/index';

let indexService: IndexService | undefined;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WikiLinksApi = { extendMarkdownIt(md: any): any };

export async function activate(context: vscode.ExtensionContext): Promise<WikiLinksApi> {
  indexService = new IndexService();
  await indexService.initialize();
  context.subscriptions.push(indexService);
  const diagnostics = new WikiDiagnostics(indexService);
  context.subscriptions.push(
    vscode.commands.registerCommand('wikiLinks.rebuildIndex', () => indexService?.refresh()),
    vscode.commands.registerCommand('wikiLinks.scanWorkspace', () => scanWorkspace(diagnostics)),
    vscode.languages.registerDocumentLinkProvider(
      { language: 'markdown' },
      new WikiDocumentLinkProvider(indexService),
    ),
    vscode.languages.registerHoverProvider(
      { language: 'markdown' },
      new WikiHoverProvider(indexService),
    ),
    vscode.languages.registerHoverProvider({ language: 'markdown' }, new FootnoteHoverProvider()),
    vscode.languages.registerCompletionItemProvider(
      { language: 'markdown' },
      new WikiCompletionProvider(indexService),
      '[',
      '/',
      '#',
      '^',
    ),
  );
  new RenameHandler().register(context);
  diagnostics.register(context);
  new WikiDecorations(indexService).register(context);

  // VSCode reads `extendMarkdownIt` off the extension's exports — i.e. activate's return value.
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    extendMarkdownIt(md: any): any {
      if (indexService) setResolver(createPreviewResolver(indexService));
      // VSCode never tells a contributed markdown-it plugin which file a preview is rendering,
      // so supply it here: the previewed file is the active text editor (the preview opens
      // beside its source). Lets the embed-cycle guard catch a file that embeds itself.
      return wireMarkdownIt(
        md,
        embedMaxDepth(),
        () => vscode.window.activeTextEditor?.document.uri.fsPath,
      );
    },
  };
}

export function deactivate(): void {
  // Release the markdown-it resolver closure so it stops pinning the IndexService.
  resetResolver();
  indexService = undefined;
}

// Scan every Markdown file in the workspace for broken wiki-links, then show the Problems pane.
async function scanWorkspace(diagnostics: WikiDiagnostics): Promise<void> {
  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Wiki Links: scanning workspace for broken links',
      cancellable: true,
    },
    (progress, token) =>
      diagnostics.scanWorkspace(token, (done, total) =>
        progress.report({ message: `${done} of ${total} files` }),
      ),
  );
  if (result.problems > 0) await showProblemsPane();
  const files = `${result.files} file${result.files === 1 ? '' : 's'}`;
  if (result.cancelled) {
    void notify(`Wiki Links: scan cancelled after ${files}.`);
  } else if (result.problems === 0) {
    void notify(`Wiki Links: no broken wiki-links in ${files}.`);
  } else {
    const problems = `${result.problems} broken wiki-link${result.problems === 1 ? '' : 's'}`;
    void notify(`Wiki Links: ${problems} in ${files}.`);
  }
}

const SHOW_PROBLEMS = 'Show Problems';

// A notification is not clickable as a whole; the button is the way to offer navigation. The
// pane is still auto-revealed when there are problems — the button covers the case where it
// was closed again, or the notification is reopened later from the bell.
async function notify(message: string): Promise<void> {
  const choice = await vscode.window.showInformationMessage(message, SHOW_PROBLEMS);
  if (choice === SHOW_PROBLEMS) await showProblemsPane();
}

function showProblemsPane(): Thenable<unknown> {
  return vscode.commands.executeCommand('workbench.actions.view.problems');
}

const DEFAULT_EMBED_MAX_DEPTH = 3;

function embedMaxDepth(): number {
  const configured = vscode.workspace
    .getConfiguration('wikiLinks')
    .get<number>('embed.maxDepth', DEFAULT_EMBED_MAX_DEPTH);
  return typeof configured === 'number' && configured >= 1 ? configured : DEFAULT_EMBED_MAX_DEPTH;
}
