import { Dictionary, builtinTerms, type Match } from '@techword/core';
import { getFavoriteIds, toggleFavorite, watchFavoriteIds } from './favorites';

const dictionary = new Dictionary(builtinTerms);

/** ホバーしてから出すまでの待ち時間。すぐ出すとポインタを動かすたびに点滅する。 */
const HOVER_DELAY_MS = 250;

const tooltip = createTooltip();
let hoverTimer: number | undefined;
let currentId: string | undefined;
let currentFavoriteButton: HTMLButtonElement | undefined;
let favoriteIds = new Set<string>();
let pointerInsideTooltip = false;

void getFavoriteIds()
  .then((ids) => {
    favoriteIds = new Set(ids);
    refreshCurrentFavoriteButton();
  })
  .catch((error: unknown) => console.error('TechTerm: お気に入りを読み込めませんでした。', error));

watchFavoriteIds((ids) => {
  favoriteIds = new Set(ids);
  refreshCurrentFavoriteButton();
});

document.addEventListener('mousemove', (event) => {
  window.clearTimeout(hoverTimer);
  if (event.composedPath().includes(tooltip.host) || pointerInsideTooltip) return;
  hoverTimer = window.setTimeout(() => handleHover(event), HOVER_DELAY_MS);
});
document.addEventListener('scroll', hide, { passive: true, capture: true });
window.addEventListener('blur', hide);

tooltip.host.addEventListener('pointerenter', () => {
  pointerInsideTooltip = true;
  window.clearTimeout(hoverTimer);
});
tooltip.host.addEventListener('pointerleave', () => {
  pointerInsideTooltip = false;
  hide();
});

function handleHover(event: MouseEvent): void {
  const caret = caretFromPoint(event.clientX, event.clientY);
  if (!caret || caret.node.nodeType !== Node.TEXT_NODE) return hide();

  const text = caret.node.textContent ?? '';
  const hit = dictionary.findAt(text, caret.offset);
  if (!hit) return hide();

  if (hit.entry.id === currentId && tooltip.host.isConnected) return;
  currentId = hit.entry.id;
  render(hit);
  position(caret.node as Text, hit);
  tooltip.host.style.display = 'block';
}

function hide(): void {
  currentId = undefined;
  currentFavoriteButton = undefined;
  pointerInsideTooltip = false;
  tooltip.host.style.display = 'none';
}

/** 一致した語の位置にツールチップを合わせる。下に出せないときは上に出す。 */
function position(node: Text, hit: Match): void {
  const range = document.createRange();
  range.setStart(node, hit.start);
  range.setEnd(node, hit.end);
  const word = range.getBoundingClientRect();

  tooltip.host.style.left = `${Math.max(8, Math.min(word.left, window.innerWidth - 360))}px`;
  tooltip.host.style.top = `${word.bottom + 6}px`;

  const box = tooltip.panel.getBoundingClientRect();
  if (word.bottom + 6 + box.height > window.innerHeight) {
    tooltip.host.style.top = `${Math.max(8, word.top - box.height - 6)}px`;
  }
}

/** textContent 経由でのみ書き込む。ページ由来の文字列を HTML として解釈させない。 */
function render({ entry }: Match): void {
  const { panel } = tooltip;
  panel.replaceChildren();

  const header = document.createElement('div');
  header.className = 'tw-header';

  const head = document.createElement('div');
  head.className = 'tw-head';
  head.textContent = entry.term;

  const favoriteButton = document.createElement('button');
  favoriteButton.type = 'button';
  favoriteButton.className = 'tw-favorite';
  updateFavoriteButton(favoriteButton, entry.id);
  favoriteButton.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    favoriteButton.disabled = true;

    try {
      const isFavorite = await toggleFavorite(entry.id);
      if (isFavorite) favoriteIds.add(entry.id);
      else favoriteIds.delete(entry.id);
      updateFavoriteButton(favoriteButton, entry.id);
    } catch (error: unknown) {
      console.error('TechTerm: お気に入りを更新できませんでした。', error);
    } finally {
      favoriteButton.disabled = false;
    }
  });
  currentFavoriteButton = favoriteButton;

  header.append(head, favoriteButton);
  panel.append(header);

  const short = document.createElement('div');
  short.className = 'tw-short';
  short.textContent = entry.short;
  panel.append(short);

  if (entry.detail) {
    const detail = document.createElement('div');
    detail.className = 'tw-detail';
    detail.textContent = entry.detail;
    panel.append(detail);
  }
  if (entry.example) {
    const example = document.createElement('pre');
    example.className = 'tw-example';
    example.textContent = entry.example;
    panel.append(example);
  }
  if (entry.link) {
    const link = document.createElement('a');
    link.className = 'tw-link';
    link.href = entry.link;
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
    link.textContent = '詳しく';
    panel.append(link);
  }
}

/** ページ側の CSS に影響されないよう Shadow DOM に閉じ込める。 */
function createTooltip(): { host: HTMLElement; panel: HTMLElement } {
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;z-index:2147483647;display:none;';
  const root = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    .tw-panel {
      max-width: 340px; padding: 10px 12px; border-radius: 8px;
      background: #1f2430; color: #e6e6e6; border: 1px solid #3a4152;
      box-shadow: 0 6px 20px rgba(0,0,0,.35);
      font: 13px/1.6 -apple-system, "Hiragino Sans", "Noto Sans JP", sans-serif;
    }
    .tw-header { display: flex; align-items: center; gap: 10px; margin-bottom: 2px; }
    .tw-head { flex: 1; min-width: 0; font-weight: 700; }
    .tw-favorite {
      display: inline-grid; place-items: center; width: 30px; height: 30px; padding: 0;
      border: 1px solid #596276; border-radius: 7px; background: #2b3241; color: #ffd166;
      cursor: pointer; font: 20px/1 sans-serif;
    }
    .tw-favorite:hover { background: #394256; }
    .tw-favorite:focus-visible { outline: 2px solid #7fb2ff; outline-offset: 2px; }
    .tw-favorite:disabled { cursor: wait; opacity: .65; }
    .tw-short { color: #f2f2f2; }
    .tw-detail { margin-top: 6px; color: #b9c0cf; }
    .tw-example {
      margin: 8px 0 0; padding: 6px 8px; border-radius: 6px; overflow-x: auto;
      background: #12161f; font: 12px/1.5 ui-monospace, SFMono-Regular, monospace;
    }
    .tw-link { display: inline-block; margin-top: 8px; color: #7fb2ff; }
  `;

  const panel = document.createElement('div');
  panel.className = 'tw-panel';
  root.append(style, panel);
  document.documentElement.append(host);

  return { host, panel };
}

function updateFavoriteButton(button: HTMLButtonElement, id: string): void {
  const isFavorite = favoriteIds.has(id);
  const label = isFavorite ? 'お気に入りから削除' : 'お気に入りに追加';
  button.textContent = isFavorite ? '★' : '☆';
  button.setAttribute('aria-pressed', String(isFavorite));
  button.setAttribute('aria-label', label);
  button.title = label;
}

function refreshCurrentFavoriteButton(): void {
  if (currentId && currentFavoriteButton) {
    updateFavoriteButton(currentFavoriteButton, currentId);
  }
}

/** Chrome (caretRangeFromPoint) と Firefox (caretPositionFromPoint) の差を吸収する。 */
function caretFromPoint(x: number, y: number): { node: Node; offset: number } | undefined {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null;
  };

  const range = doc.caretRangeFromPoint?.(x, y);
  if (range) return { node: range.startContainer, offset: range.startOffset };

  const pos = doc.caretPositionFromPoint?.(x, y);
  if (pos) return { node: pos.offsetNode, offset: pos.offset };

  return undefined;
}
