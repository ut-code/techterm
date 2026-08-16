/**
 * 表記ゆれを吸収して照合キーに変換する。
 *
 *   useState   -> "use state"
 *   API_KEY    -> "api key"
 *   HTTPServer -> "http server"
 *   garbage-collection -> "garbage collection"
 *
 * 辞書のキー側とクエリ側の両方をこれに通すので、辞書には自然な表記で書けばよい。
 */
export function normalize(input: string): string {
  return input
    .normalize('NFKC')
    // camelCase / PascalCase の境界に空白を入れる
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    // 連続大文字の直後に単語が続く場合（HTTPServer -> HTTP Server）
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    // 区切り記号を空白に
    .replace(/[_\-./:]+/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 空白を潰した形。"use state" と "usestate" を同一視するための第 2 キー。
 */
export function tighten(normalized: string): string {
  return normalized.replace(/\s+/g, '');
}

/**
 * 語トークンの抽出。ASCII の識別子と、カタカナの連続を 1 トークンとして扱う。
 * 漢字・ひらがなは形態素解析なしでは切れないので、辞書側にカタカナ/英字の
 * 別名を書いてもらう前提であえて対象外にしている。
 */
const TOKEN_RE = /[A-Za-z_$][A-Za-z0-9_$]*|[ァ-ヶーｦ-ﾟ]+/gu;

export interface Token {
  text: string;
  start: number;
  end: number;
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}
