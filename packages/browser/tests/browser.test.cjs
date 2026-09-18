const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const { buildSync } = require('esbuild');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
function bundle(file, name = 'TestModule') {
  return buildSync({ entryPoints: [path.join(root, 'src', file)], bundle: true, write: false, format: 'iife', globalName: name }).outputFiles[0].text + `\nglobalThis.${name} = ${name};`;
}
const highlighterCode = bundle('highlighter.ts');
const settingsCode = bundle('category-settings.ts');
const contentCode = bundle('content.ts');
const sidepanelCode = bundle('sidepanel.ts');
function dom(html = '<p>JavaScript</p>') {
  const d = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
  const observers = [];
  const NativeObserver = d.window.MutationObserver;
  d.window.MutationObserver = class extends NativeObserver {
    constructor(callback) { super(callback); observers.push(this); }
  };
  const close = d.window.close.bind(d.window);
  d.window.close = () => { observers.forEach(observer => observer.disconnect()); close(); };
  d.window.Highlight = class extends Set {};
  d.window.CSS = { highlights: new Map() };
  return d;
}
const settle = async (w) => { await new Promise(resolve => w.requestAnimationFrame(() => w.requestAnimationFrame(resolve))); };
function storage(w, initial = {}, options = {}) {
  const data = { ...initial };
  const listeners = new Set();
  const emit = (changes, area = 'sync') => listeners.forEach(fn => fn(changes, area));
  w.chrome = { storage: { onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) }, sync: {
    get: async () => {
      const snapshot = { ...data };
      if (options.beforeRead) await options.beforeRead(emit);
      return snapshot;
    },
    set: async (values) => {
      if (options.failWrite) throw Error('write failed');
      const changes = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { oldValue: data[k], newValue: v }]));
      Object.assign(data, values); emit(changes);
    },
  } } };
  return { data, emit };
}

test('1,000段落のうち変更・追加されたテキストだけを検索し、削除Rangeを除去する', async () => {
  const d = dom('<main>' + '<p>JavaScript</p>'.repeat(1000) + '</main>');
  const w = d.window;
  try {
    w.eval(highlighterCode);
    const calls = [];
    const dictionary = { findAll: text => { calls.push(text); return text ? [{ start: 0, end: text.length }] : []; } };
    const h = new w.TestModule.IncrementalHighlighter(dictionary);
    const highlight = w.CSS.highlights.get('tw-highlight');
    assert.equal(calls.length, 1000);
    const unchanged = [...highlight][1];
    calls.length = 0;
    w.document.querySelector('p').firstChild.data = 'TypeScript';
    await settle(w);
    assert.deepEqual(calls, ['TypeScript']);
    assert.ok(highlight.has(unchanged));
    calls.length = 0;
    const wrapper = w.document.createElement('section');
    wrapper.innerHTML = '<p>React</p><p>Vue</p>';
    w.document.querySelector('main').append(wrapper);
    wrapper.firstChild.firstChild.data = 'Nuxt';
    await settle(w);
    assert.deepEqual(calls, ['Nuxt', 'Vue']);
    calls.length = 0;
    wrapper.remove();
    await settle(w);
    assert.equal(highlight.size, 1000);
    assert.equal(calls.length, 0);
    h.disconnect();
  } finally { w.close(); }
});

test('ノード移動・body差し替え・編集領域の切り替えでも古いRangeを残さない', async () => {
  const d = dom('<section><p>React</p></section><aside></aside>'); const w = d.window;
  try {
    w.eval(highlighterCode);
    const h = new w.TestModule.IncrementalHighlighter({ findAll: text => [{ start: 0, end: text.length }] });
    const ranges = w.CSS.highlights.get('tw-highlight');
    w.document.querySelector('aside').append(w.document.querySelector('p'));
    await settle(w); assert.equal(ranges.size, 1);
    w.document.querySelector('aside').setAttribute('contenteditable', 'true');
    await settle(w); assert.equal(ranges.size, 0);
    w.document.querySelector('aside').removeAttribute('contenteditable');
    await settle(w); assert.equal(ranges.size, 1);
    const body = w.document.createElement('body'); body.innerHTML = '<p>Git</p>';
    w.document.body.replaceWith(body); await settle(w);
    assert.equal(ranges.size, 1); assert.equal([...ranges][0].toString(), 'Git');
    h.disconnect();
  } finally { w.close(); }
});

test('設定の初回読込中に受信した変更が古い値で上書きされない', async () => {
  const d = dom(); const w = d.window;
  try {
    storage(w, {}, { beforeRead: async emit => emit({ 'termCategory.javascript': { newValue: false } }) });
    w.eval(settingsCode);
    let received;
    const stop = w.TestModule.observeCategorySettings(value => { received = value; }, assert.fail);
    await settle(w);
    assert.equal(received.javascript, false);
    assert.equal(received.basics, true);
    await w.TestModule.setCategoryEnabled('basics', false);
    assert.equal(received.javascript, false); assert.equal(received.basics, false);
    stop();
  } finally { w.close(); }
});

test('カテゴリOFFで表示済みの説明とハイライトが消え、ONで戻る。お気に入りは保持', async () => {
  const d = dom('<p>JavaScript</p>'); const w = d.window;
  try {
    const { data } = storage(w, { favoriteTermIds: ['javascript'] });
    const node = w.document.querySelector('p').firstChild;
    w.document.caretRangeFromPoint = () => { const r = w.document.createRange(); r.setStart(node, 2); return r; };
    w.Range.prototype.getBoundingClientRect = () => ({ left: 10, bottom: 20, top: 5 });
    w.eval(contentCode); await settle(w);
    const hover = async () => { w.document.dispatchEvent(new w.MouseEvent('mousemove', { clientX: 20, clientY: 10 })); await new Promise(r => w.setTimeout(r, 280)); };
    const host = w.document.querySelector('[data-techterm-ui]');
    assert.equal(w.CSS.highlights.get('tw-highlight').size, 1);
    await hover(); assert.equal(host.style.display, 'block');
    await w.chrome.storage.sync.set({ 'termCategory.javascript': false });
    assert.equal(host.style.display, 'none');
    assert.equal(w.CSS.highlights.get('tw-highlight').size, 0);
    await hover(); assert.equal(host.style.display, 'none');
    await w.chrome.storage.sync.set({ 'termCategory.javascript': true });
    assert.equal(w.CSS.highlights.get('tw-highlight').size, 1);
    await hover(); assert.equal(host.style.display, 'block');
    assert.deepEqual(data.favoriteTermIds, ['javascript']);
  } finally { w.close(); }
});

test('サイドパネルに7カテゴリを表示し、保存と失敗時の復元を行う', async () => {
  const d = dom(fs.readFileSync(path.join(root, 'sidepanel.html'), 'utf8')); const w = d.window;
  try {
    const options = {}; const { data, emit } = storage(w, { 'termCategory.javascript': false }, options);
    w.eval(sidepanelCode); await settle(w);
    const inputs = [...w.document.querySelectorAll('#term-categories input')];
    assert.equal(inputs.length, 7); assert.equal(inputs[1].checked, false);
    inputs[0].click(); await settle(w);
    assert.equal(data['termCategory.basics'], false);
    assert.equal(data['termCategory.javascript'], false);
    const errors = []; w.console.error = (...args) => errors.push(args);
    options.failWrite = true; inputs[0].click(); await settle(w);
    assert.equal(errors.length, 1);
    assert.equal(inputs[0].checked, false); assert.equal(inputs[0].disabled, false);
    assert.equal(w.document.querySelector('#settings-error').hidden, false);
    emit({ 'termCategory.javascript': { newValue: true } });
    assert.equal(inputs[1].checked, true);
  } finally { w.close(); }
});

test('全カテゴリOFFの保存状態で起動すると、後から追加した用語も表示しない', async () => {
  const d = dom('<p>JavaScript Git API</p>'); const w = d.window;
  try {
    const ids = ['basics', 'javascript', 'frameworks', 'html-css', 'development', 'network-data', 'design-performance'];
    storage(w, Object.fromEntries(ids.map(id => ['termCategory.' + id, false])));
    w.eval(contentCode); await settle(w);
    assert.equal(w.CSS.highlights.get('tw-highlight').size, 0);
    const p = w.document.createElement('p'); p.textContent = 'React'; w.document.body.append(p);
    await settle(w);
    assert.equal(w.CSS.highlights.get('tw-highlight').size, 0);
    await w.chrome.storage.sync.set({ 'termCategory.frameworks': true });
    assert.equal(w.CSS.highlights.get('tw-highlight').size, 1);
  } finally { w.close(); }
});
