// Runs inside VSCode's Markdown preview webview (contributes.markdown.previewScripts). When a
// footnote plugin (e.g. bierner.markdown-footnotes → markdown-it-footnote) has rendered
// footnotes, hovering a reference shows the footnote body in a card, cloned from the
// `<li id="fn…">` the plugin already put at the end of the page — so no data is shipped and,
// without such a plugin, there is nothing to hook and the script is inert. Listeners are
// delegated on `document` because the preview replaces its DOM on every update.
// Browser APIs only: no vscode, no Node.

// markdown-it-footnote links a reference to `#fn<n>`; the back-reference inside a footnote
// body links to `#fnref<n>` and must not open a card.
export function footnoteTargetId(href: string | null): string | undefined {
  const m = href && /^#(fn\d+)$/.exec(href);
  return m ? m[1] : undefined;
}

export function tooltipTitle(id: string): string {
  return `Footnote ${id.slice(2)}`;
}

const CARD_CLASS = 'wiki-footnote-hover';
const CARD_ID = 'wiki-footnote-hover-card';
const REF_SELECTOR = '.footnote-ref a, a.footnote-ref';

export function installFootnoteHover(doc: Document): void {
  let card: HTMLElement | undefined;

  const hide = (): void => {
    card?.remove();
    card = undefined;
    doc.querySelectorAll(`[aria-describedby="${CARD_ID}"]`).forEach((a) => {
      a.removeAttribute('aria-describedby');
    });
  };

  const show = (anchor: HTMLAnchorElement): void => {
    const id = footnoteTargetId(anchor.getAttribute('href'));
    const body = id ? doc.getElementById(id) : null;
    if (!id || !body) return;
    hide();
    card = doc.createElement('div');
    card.className = CARD_CLASS;
    card.id = CARD_ID;
    card.setAttribute('role', 'tooltip');
    card.title = tooltipTitle(id);
    anchor.setAttribute('aria-describedby', CARD_ID);
    // Same-document content the preview has already sanitized and rendered.
    card.innerHTML = body.innerHTML;
    card.querySelectorAll('.footnote-backref').forEach((el) => el.remove());
    card.addEventListener('mouseleave', hide);
    doc.body.appendChild(card);
    const r = anchor.getBoundingClientRect();
    const view = doc.defaultView;
    const scrollX = view?.scrollX ?? 0;
    const scrollY = view?.scrollY ?? 0;
    const maxLeft = scrollX + doc.documentElement.clientWidth - card.offsetWidth - 4;
    card.style.left = `${Math.max(4, Math.min(scrollX + r.left, maxLeft))}px`;
    // Overlap the anchor by a pixel so the pointer can travel into the card without crossing
    // a gap that would fire mouseout (and hide it) on the way.
    card.style.top = `${scrollY + r.bottom - 1}px`;
  };

  const anchorOf = (target: EventTarget | null): HTMLAnchorElement | null =>
    target instanceof Element ? target.closest<HTMLAnchorElement>(REF_SELECTOR) : null;

  doc.addEventListener('mouseover', (e) => {
    const a = anchorOf(e.target);
    if (a) show(a);
  });
  doc.addEventListener('mouseout', (e) => {
    if (!anchorOf(e.target)) return;
    const to = (e as MouseEvent).relatedTarget;
    if (card && to instanceof Node && card.contains(to)) return; // moving into the card
    hide();
  });
  doc.addEventListener('focusin', (e) => {
    const a = anchorOf(e.target);
    if (a) show(a);
  });
  doc.addEventListener('focusout', hide);
  doc.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape') hide();
  });
  // Scrolling the page dismisses the card (its position is absolute); scrolling inside the
  // card — a wide code block in the footnote — must not.
  doc.addEventListener(
    'scroll',
    (e) => {
      if (e.target === doc) hide();
    },
    true,
  );
}

if (typeof document !== 'undefined') installFootnoteHover(document);
