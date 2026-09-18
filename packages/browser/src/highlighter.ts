import type { Dictionary } from '@techword/core';

/** スクリプト・入力欄・拡張機能自身のUIは検索しない。 */
export function isSearchableText(node: Text): boolean {
  return Boolean(document.body?.contains(node)) &&
    !node.parentElement?.closest('script, style, textarea, input, [contenteditable]:not([contenteditable="false"]), [data-techterm-ui]');
}

/** DOMの変更箇所だけを検索し、変更のないRangeは保持する。 */
export class IncrementalHighlighter {
  private readonly ranges = new Map<Text, Range[]>();
  private readonly highlight = typeof Highlight === 'undefined' ? undefined : new Highlight();
  private readonly pending = new Set<Node>();
  private readonly removed = new Set<Node>();
  private frame: number | undefined;
  private readonly observer: MutationObserver;

  constructor(private dictionary: Dictionary) {
    if (this.highlight) CSS.highlights.set('tw-highlight', this.highlight);
    this.observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'characterData' || record.type === 'attributes') {
          this.pending.add(record.target);
        } else {
          for (const node of record.removedNodes) this.removed.add(node);
          for (const node of record.addedNodes) this.pending.add(node);
        }
      }
      if (this.frame === undefined) this.frame = requestAnimationFrame(() => this.flush());
    });
    this.observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ['contenteditable'],
    });
    this.rescan();
  }

  setDictionary(dictionary: Dictionary): void {
    this.dictionary = dictionary;
    // 設定変更時だけ全体を再検索。通常のDOM更新では行わない。
    this.rescan();
  }

  disconnect(): void {
    this.observer.disconnect();
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.ranges.clear();
    this.pending.clear();
    this.removed.clear();
    this.highlight?.clear();
    CSS.highlights?.delete('tw-highlight');
  }

  private rescan(): void {
    if (this.frame !== undefined) cancelAnimationFrame(this.frame);
    this.frame = undefined;
    this.pending.clear();
    this.removed.clear();
    this.observer.takeRecords();
    this.ranges.clear();
    this.highlight?.clear();
    if (document.body) this.visit(document.body, (node) => this.update(node));
  }

  private flush(): void {
    this.frame = undefined;
    // 移動したノードは旧Rangeを消してから、最終的な場所で再検索する。
    for (const root of this.topLevelRoots(this.removed)) this.visit(root, (node) => this.remove(node));
    for (const root of this.topLevelRoots(this.pending)) this.visit(root, (node) => this.update(node));
    this.removed.clear();
    this.pending.clear();
  }

  private topLevelRoots(nodes: Set<Node>): Node[] {
    return [...nodes].filter((node) => {
      for (let parent = node.parentNode; parent; parent = parent.parentNode) {
        if (nodes.has(parent)) return false;
      }
      return true;
    });
  }

  private visit(root: Node, action: (node: Text) => void): void {
    if (root.nodeType === Node.TEXT_NODE) {
      action(root as Text);
      return;
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) action(walker.currentNode as Text);
  }

  private remove(node: Text): void {
    for (const range of this.ranges.get(node) ?? []) this.highlight?.delete(range);
    this.ranges.delete(node);
  }

  private update(node: Text): void {
    this.remove(node);
    if (!this.highlight || !isSearchableText(node)) return;
    const ranges: Range[] = [];
    for (const { start, end } of this.dictionary.findAll(node.data)) {
      const range = new Range();
      range.setStart(node, start);
      range.setEnd(node, end);
      ranges.push(range);
      this.highlight.add(range);
    }
    if (ranges.length) this.ranges.set(node, ranges);
  }
}
