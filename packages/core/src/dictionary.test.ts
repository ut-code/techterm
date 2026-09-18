import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Dictionary, builtinDictionary, builtinTerms, termCategories, normalize } from './index';

test('normalize が表記ゆれを吸収する', () => {
  assert.equal(normalize('useState'), 'use state');
  assert.equal(normalize('API_KEY'), 'api key');
  assert.equal(normalize('HTTPServer'), 'http server');
  assert.equal(normalize('garbage-collection'), 'garbage collection');
});

test('大文字小文字・区切り違いでも同じエントリを引く', () => {
  const byCamel = builtinDictionary.lookup('useState');
  const bySnake = builtinDictionary.lookup('use_state');
  assert.ok(byCamel);
  assert.equal(byCamel.id, 'use-state');
  assert.equal(bySnake?.id, 'use-state');
});

test('別名（日本語・略語）でも引ける', () => {
  assert.equal(builtinDictionary.lookup('ガベコレ')?.id, 'gc');
  assert.equal(builtinDictionary.lookup('GC')?.id, 'gc');
  assert.equal(builtinDictionary.lookup('冪等')?.id, 'idempotent');
});

test('findAt が複合語を単語より優先する', () => {
  const text = 'ここで garbage collection が走る';
  const hit = builtinDictionary.findAt(text, text.indexOf('collection'));
  assert.equal(hit?.entry.id, 'gc');
  assert.equal(text.slice(hit!.start, hit!.end), 'garbage collection');
});

test('findAt は語をまたぐ区切りを複合語とみなさない', () => {
  const text = 'const garbage = 1; collection.push(x);';
  const hit = builtinDictionary.findAt(text, text.indexOf('collection'));
  assert.equal(hit, undefined);
});

test('lang 指定があるとその言語向けのエントリが優先される', () => {
  const dict = new Dictionary([
    { id: 'generic-any', term: 'any', short: '任意の値。' },
    { id: 'ts-any', term: 'any', short: '型チェックを止める型。', langs: ['typescript'] },
  ]);
  assert.equal(dict.lookup('any', { lang: 'typescript' })?.id, 'ts-any');
  assert.equal(dict.lookup('any', { lang: 'python' })?.id, 'generic-any');
  assert.equal(dict.lookup('any')?.id, 'generic-any');
});

test('未登録の語は undefined', () => {
  assert.equal(builtinDictionary.lookup('foobarbaz'), undefined);
});

test('同梱用語はすべて既知のカテゴリに属し、IDは一意', () => {
  const categories = new Set<string>(termCategories.map(({ id }) => id));
  assert.equal(new Set(builtinTerms.map(({ id }) => id)).size, builtinTerms.length);
  for (const entry of builtinTerms) assert.ok(entry.category && categories.has(entry.category), entry.id);
});

test('追加した基本語・Web用語を英語や略語で検索できる', () => {
  for (const [surface, id] of [['variable', 'variable'], ['async/await', 'async-await'], ['props', 'props'], ['CSS Grid', 'css-grid'], ['CI', 'continuous-integration'], ['JSON', 'json'], ['rate limit', 'rate-limit']]) {
    assert.equal(builtinDictionary.lookup(surface)?.id, id);
    const text = `Use ${surface} here`;
    assert.ok(builtinDictionary.findAll(text).some(hit => hit.entry.id === id), surface);
  }
});

test('日本語の文章中から用語を拾い、ハイライトとホバーの範囲が一致する', () => {
  const text = '😀変数に配列を代入し、関数の戻り値を確認する。';
  const matches = builtinDictionary.findAll(text);
  assert.deepEqual(matches.map(hit => text.slice(hit.start, hit.end)), ['変数', '配列', '関数', '戻り値']);
  for (const hit of matches) {
    for (let i = hit.start; i < hit.end; i++) assert.deepEqual(builtinDictionary.findAt(text, i), hit);
  }
});

test('日本語の複合語を優先し、カテゴリで除外した語や一般的な一文字を拾わない', () => {
  const text = '仮引数と引数、仮想DOMとDOM、コールバック関数';
  const matches = builtinDictionary.findAll(text);
  assert.deepEqual(matches.map(hit => hit.entry.id), ['parameter', 'argument', 'virtual-dom', 'dom', 'callback']);
  assert.equal(builtinDictionary.findAt(text, text.indexOf('DOM'))?.entry.id, 'virtual-dom');
  const filtered = new Dictionary(builtinTerms.filter(entry => entry.category !== 'basics'));
  assert.equal(filtered.findAll('変数と配列と関数').length, 0);
  assert.equal(filtered.findAt('変数', 0), undefined);
  assert.equal(builtinDictionary.findAll('値と幅').length, 0);
});
