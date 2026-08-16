import type { TermEntry } from './types';

/**
 * ツールチップ本文を Markdown で組み立てる。
 * VS Code は MarkdownString がそのまま使え、ブラウザ側はここから最小限の
 * HTML に変換する（packages/browser/src/content.ts を参照）。
 */
export function toMarkdown(entry: TermEntry): string {
  const lines: string[] = [`**${entry.term}** — ${entry.short}`];

  if (entry.detail) lines.push('', entry.detail);
  if (entry.example) lines.push('', '```', entry.example, '```');
  if (entry.link) lines.push('', `[詳しく](${entry.link})`);

  return lines.join('\n');
}
