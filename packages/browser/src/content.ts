import { Dictionary, builtinTerms, type Match } from '@techword/core';

const dictionary = new Dictionary(builtinTerms);

/** ホバーしてから出すまでの待ち時間。すぐ出すとポインタを動かすたびに点滅する。 */
const HOVER_DELAY_MS = 250;

const tooltip = createTooltip();
let hoverTimer: number | undefined;
let currentId: string | undefined;

document.addEventListener('mousemove', (event) => {
  window.clearTimeout(hoverTimer);
  hoverTimer = window.setTimeout(() => handleHover(event), HOVER_DELAY_MS);
});
document.addEventListener('scroll', hide, { passive: true, capture: true });
window.addEventListener('blur', hide);

function handleHover(event: MouseEvent): void {
  if (tooltip.host.style.display === 'block' && tooltip.host.matches(':hover')) return; // ツールチップ上にマウスがあるときはツールチップを消さないようにする
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

  const head = document.createElement('div');
  head.className = 'tw-head';
  head.textContent = entry.term;
  panel.append(head);

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
    .tw-head { font-weight: 700; margin-bottom: 2px; }
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
