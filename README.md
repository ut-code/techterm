# Techterm

プログラミング用語にマウスをホバーすると、意味を簡潔に表示します。
VS Code 拡張とブラウザ拡張の 2 つがあり、辞書と検索ロジックは共通です。

## 構成

```
packages/core     辞書・正規化・検索（プラットフォーム非依存、ここが本体）
  src/data/terms.json   辞書データ。ここを育てるのが日々の作業
packages/vscode   VS Code 拡張。HoverProvider で core を呼ぶだけ
packages/browser  Chrome 拡張 (MV3)。content script で core を呼ぶだけ
```

新しい表示先（JetBrains、Slack bot など）を足したくなっても、core はそのまま使えます。

## 開発

```sh
npm install
npm run build     # 3 パッケージまとめて
npm test          # core のテスト
```

### VS Code 拡張を動かす

このリポジトリを VS Code で開いて **F5**。拡張機能開発ホストが立ち上がるので、
適当なファイルで `useState` や `garbage collection` にホバーします。

コードを変えたら `npm run build` のあと、開発ホストのウィンドウで
「Developer: Reload Window」。

### ブラウザ拡張を動かす

```sh
npm run build -w @techword/browser
```

`chrome://extensions` → デベロッパーモード ON → 「パッケージ化されていない拡張機能を読み込む」
で `packages/browser/dist` を選択。任意のページで用語にホバーします。

ホバー内の `☆` を押すと用語をお気に入りに追加でき、もう一度押すと解除できます。
Chrome のツールバーにある TechTerm のアイコンを押すとサイドパネルが開き、
お気に入りの確認、個別削除、全削除ができます。お気に入りは Chrome の同期ストレージに保存されます。

## 辞書を増やす

`packages/core/src/data/terms.json` に追記します。

```json
{
  "id": "closure",
  "term": "closure",
  "match": ["クロージャ", "クロージャー"],
  "short": "自分が作られた場所の変数を覚えている関数。",
  "detail": "関数が定義されたスコープの変数を、外に持ち出された後も参照し続ける仕組み。",
  "example": "const counter = (() => { let n = 0; return () => ++n; })();",
  "link": "https://developer.mozilla.org/ja/docs/Web/JavaScript/Closures",
  "langs": ["javascript", "typescript"]
}
```

- `short` は 1 行。ここだけ読めば分かる長さにする。
- `detail` は 2〜3 行まで。長くするとホバーの利点が消えます。
- `match` は**別名だけ**書けば十分です。大文字小文字・camelCase・snake_case・
  ハイフン・スペースの違いは正規化が吸収します（`useState` = `use_state` = `USE STATE`）。
- `langs` は同じ綴りで言語ごとに意味が違う語を分けるとき用。省略すると全言語で表示。

VS Code 側は設定 `techword.userTerms` からも同じ形式で追加・上書きできます
（`id` が同じならユーザー設定が勝ちます）。

## 設計メモ

- **辞書引きは同期・オフライン**。ホバーは体感 100ms 以内に出ないと使われないので、
  ネットワークを挟まない前提で組んでいます。
- **複合語を優先**。`garbage collection` の上では `collection` 単体ではなく複合語を引きます
  （最大 4 トークン、長い一致から順に）。
- **漢字・ひらがなは切り出さない**。形態素解析なしでは境界が決まらないため、
  日本語の別名はカタカナか英字で `match` に書く運用です。
