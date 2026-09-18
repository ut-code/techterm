/** 表示設定で使う安定したカテゴリIDと表示名。 */
export const termCategories = [
  { id: 'basics', label: 'プログラミング基礎' },
  { id: 'javascript', label: 'JavaScript・TypeScript' },
  { id: 'frameworks', label: 'React・Vue' },
  { id: 'html-css', label: 'HTML・CSS' },
  { id: 'development', label: 'Git・開発ツール' },
  { id: 'network-data', label: '通信・データベース' },
  { id: 'design-performance', label: '設計・性能' },
] as const;

export type TermCategory = (typeof termCategories)[number]['id'];
