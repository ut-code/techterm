/** 辞書 1 件分のエントリ。data/terms.json がこの配列。 */
export interface TermEntry {
  /** 安定した内部 ID。ファイル内で一意にする。 */
  id: string;
  /** 見出しとして表示する語。 */
  term: string;
  /**
   * ホバー時に照合する表記のリスト。term 自身も自動で含まれる。
   * 大文字小文字・camelCase・snake_case・スペースの違いは正規化で吸収されるので、
   * ここには「別名」だけ書けばよい（例: "GC", "ガベコレ"）。
   */
  match?: string[];
  /** 1 行の要約。ツールチップの太字部分。 */
  short: string;
  /** 2〜3 行の補足。長くしすぎないこと。 */
  detail?: string;
  /** 短いコード例（任意）。 */
  example?: string;
  /** 参考リンク（任意）。 */
  link?: string;
  /**
   * この語が意味を持つ言語の VS Code languageId。
   * 省略 = 全言語。同じ綴りで言語ごとに意味が違う語を分けるために使う。
   */
  langs?: string[];
}

/** テキスト中で語を見つけた結果。 */
export interface Match {
  entry: TermEntry;
  /** 検索対象テキスト内での一致範囲。ハイライトや下線に使う。 */
  start: number;
  end: number;
}

export interface LookupOptions {
  /** VS Code の languageId。渡すと langs による絞り込みが効く。 */
  lang?: string;
}
