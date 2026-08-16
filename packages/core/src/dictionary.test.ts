import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Dictionary, builtinDictionary, normalize } from './index';

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
