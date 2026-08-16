import * as vscode from 'vscode';
import { Dictionary, builtinTerms, toMarkdown, type TermEntry } from '@techword/core';

let dictionary = new Dictionary(builtinTerms);

export function activate(context: vscode.ExtensionContext): void {
  rebuildDictionary();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('techword.userTerms')) rebuildDictionary();
    }),
    // 言語ごとに登録すると設定変更のたびに登録し直しになるので、
    // すべてに登録して provideHover 側で絞り込む。
    vscode.languages.registerHoverProvider({ scheme: '*', language: '*' }, { provideHover }),
  );
}

export function deactivate(): void {}

/** 同梱辞書にユーザー辞書を重ねて作り直す。id が同じならユーザー側で置き換える。 */
function rebuildDictionary(): void {
  const userTerms = config().get<TermEntry[]>('userTerms', []);
  const merged = new Map(builtinTerms.map((e) => [e.id, e]));
  for (const entry of userTerms) {
    if (entry?.id && entry.term && entry.short) merged.set(entry.id, entry);
  }
  dictionary = new Dictionary([...merged.values()]);
}

function provideHover(
  document: vscode.TextDocument,
  position: vscode.Position,
): vscode.Hover | undefined {
  if (!config().get<boolean>('enabled', true)) return undefined;

  const languages = config().get<string[]>('languages', ['*']);
  if (!languages.includes('*') && !languages.includes(document.languageId)) return undefined;

  const line = document.lineAt(position.line).text;
  const hit = dictionary.findAt(line, position.character, { lang: document.languageId });
  if (!hit) return undefined;

  const markdown = new vscode.MarkdownString(toMarkdown(hit.entry));
  markdown.supportHtml = false;
  // 辞書は同梱・ユーザー設定由来だが、link を踏ませる以上コマンドリンクは無効のままにする。
  markdown.isTrusted = false;

  const range = new vscode.Range(
    position.line,
    hit.start,
    position.line,
    hit.end,
  );
  return new vscode.Hover(markdown, range);
}

function config(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('techword');
}
