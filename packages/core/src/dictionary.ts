import { normalize, tighten, tokenize } from './normalize';
import type { LookupOptions, Match, TermEntry } from './types';

/** 複合語を何トークンまで見るか。"garbage collection" = 2, "single source of truth" = 4。 */
const MAX_PHRASE_TOKENS = 4;

/** トークンとトークンの間に許す文字（ここ以外が挟まれば別の語とみなす）。 */
const JOINER_RE = /^[\s\-_./]*$/;

interface JapaneseNode {
  children: Map<string, JapaneseNode>;
  surface?: string;
}

export class Dictionary {
  private readonly japanese: JapaneseNode = { children: new Map() };

  /** 正規化キー -> エントリ群（同綴りで言語違いがありうるので配列）。 */
  private readonly index = new Map<string, TermEntry[]>();

  constructor(entries: readonly TermEntry[]) {
    for (const entry of entries) {
      for (const surface of [entry.term, ...(entry.match ?? [])]) {
        const norm = normalize(surface);
        if (!norm) continue;
        this.add(norm, entry);
        // 漢字・ひらがなを含む登録済み表記だけを直接照合する。
        // 「値」「幅」など一文字の一般語は文章中で過剰に検出しない。
        if (surface.length > 1 && /[\p{Script=Han}\p{Script=Hiragana}]/u.test(surface)) {
          let node = this.japanese;
          for (let i = 0; i < surface.length; i++) {
            const char = surface[i];
            if (!node.children.has(char)) node.children.set(char, { children: new Map() });
            node = node.children.get(char)!;
          }
          node.surface = surface;
        }
        const tight = tighten(norm);
        if (tight !== norm) this.add(tight, entry);
      }
    }
  }

  private add(key: string, entry: TermEntry): void {
    const bucket = this.index.get(key);
    if (bucket) {
      if (!bucket.includes(entry)) bucket.push(entry);
    } else {
      this.index.set(key, [entry]);
    }
  }

  /** 単一の語句を引く。ホバー位置が分かっていない場合はこちら。 */
  lookup(surface: string, options: LookupOptions = {}): TermEntry | undefined {
    const norm = normalize(surface);
    return this.pick(norm, options) ?? this.pick(tighten(norm), options);
  }

  private pick(key: string, { lang }: LookupOptions): TermEntry | undefined {
    const bucket = this.index.get(key);
    if (!bucket) return undefined;
    if (lang) {
      // 言語指定つきのエントリを優先し、なければ言語非依存のものにフォールバック
      const scoped = bucket.find((e) => e.langs?.includes(lang));
      if (scoped) return scoped;
    }
    return bucket.find((e) => !e.langs) ?? bucket[0];
  }

  /**
   * `text` の `offset` 位置にある語を引く。複合語を優先し、長い一致から試す。
   * VS Code のホバーもブラウザのホバーもこの 1 関数に集約する。
   */
  findAt(text: string, offset: number, options: LookupOptions = {}): Match | undefined {
    const tokenMatch = this.findTokenAt(text, offset, options);
    const japaneseMatches = this.findJapanese(text, options)
      .filter(({ start, end }) => offset >= start && offset < end);
    if (tokenMatch) japaneseMatches.push(tokenMatch);
    return japaneseMatches.sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
  }

  private findTokenAt(text: string, offset: number, options: LookupOptions): Match | undefined {
    const tokens = tokenize(text);
    const hit = tokens.findIndex((t) => offset >= t.start && offset <= t.end);
    if (hit === -1) return undefined;

    for (let len = MAX_PHRASE_TOKENS; len >= 1; len--) {
      // カーソル位置のトークンを含む窓を、左寄りから順に試す
      for (let start = hit - len + 1; start <= hit; start++) {
        if (start < 0 || start + len > tokens.length) continue;
        const window = tokens.slice(start, start + len);
        if (!isContiguous(text, window)) continue;

        const phrase = window.map((t) => t.text).join(' ');
        const entry = this.lookup(phrase, options);
        if (entry) {
          return { entry, start: window[0].start, end: window[window.length - 1].end };
        }
      }
    }
    return undefined;
  }

  findAll(text: string, options: LookupOptions = {}): Match[] {
    const tokens = tokenize(text);
    const matches: Match[] = [];
    for (let start = 0; start < tokens.length; start++) {
      for (let len = MAX_PHRASE_TOKENS; len >= 1; len--) {
        if (start + len > tokens.length) continue;
        const window = tokens.slice(start, start + len);
        if (!isContiguous(text, window)) continue;

        const phrase = window.map((t) => t.text).join(' ');
        const entry = this.lookup(phrase, options);
        if (entry) {
          matches.push({ entry, start: window[0].start, end: window[window.length - 1].end });
          start += len - 1; //forループでstartが++されることを考慮する
          break;
        }
      }
    }
    const combined = [...matches, ...this.findJapanese(text, options)]
      .sort((a, b) => a.start - b.start || b.end - a.end);
    const result: Match[] = [];
    for (const match of combined) {
      if (!result.length || match.start >= result[result.length - 1].end) result.push(match);
    }
    return result;
  }

  private findJapanese(text: string, options: LookupOptions): Match[] {
    const matches: Match[] = [];
    for (let start = 0; start < text.length; start++) {
      let node = this.japanese;
      let longest: Match | undefined;
      for (let end = start; end < text.length; end++) {
        const next = node.children.get(text[end]);
        if (!next) break;
        node = next;
        if (node.surface) {
          const entry = this.lookup(node.surface, options);
          if (entry) longest = { entry, start, end: end + 1 };
        }
      }
      if (longest) {
        matches.push(longest);
        start = longest.end - 1;
      }
    }
    return matches;
  }
}

/** 窓内のトークンが空白・ハイフン程度でしか隔てられていないか。 */
function isContiguous(text: string, window: readonly { start: number; end: number }[]): boolean {
  for (let i = 1; i < window.length; i++) {
    if (!JOINER_RE.test(text.slice(window[i - 1].end, window[i].start))) return false;
  }
  return true;
}
