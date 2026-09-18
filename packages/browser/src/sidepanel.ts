import { defaultCategorySettings, observeCategorySettings, setCategoryEnabled } from './category-settings';
import { builtinTerms, termCategories, type TermCategory, type TermEntry } from '@techword/core';
import {
  clearFavorites,
  getFavoriteIds,
  removeFavorite,
  watchFavoriteIds,
} from './favorites';

const favoriteList = requireElement<HTMLUListElement>('favorites');
const emptyMessage = requireElement<HTMLParagraphElement>('empty');
const count = requireElement<HTMLParagraphElement>('count');
const clearButton = requireElement<HTMLButtonElement>('clear-favorites');
const errorMessage = requireElement<HTMLParagraphElement>('error');
const termsById = new Map(builtinTerms.map((entry) => [entry.id, entry]));

let currentFavoriteIds: string[] = [];

clearButton.addEventListener('click', async () => {
  if (currentFavoriteIds.length === 0) return;
  if (!window.confirm('お気に入りをすべて削除しますか？')) return;

  clearButton.disabled = true;
  hideError();
  try {
    await clearFavorites();
    renderFavorites([]);
  } catch (error: unknown) {
    showError('お気に入りを削除できませんでした。', error);
    clearButton.disabled = false;
  }
});

watchFavoriteIds(renderFavorites);
void loadFavorites();

async function loadFavorites(): Promise<void> {
  hideError();
  try {
    renderFavorites(await getFavoriteIds());
  } catch (error: unknown) {
    renderFavorites([]);
    showError('お気に入りを読み込めませんでした。', error);
  }
}

function renderFavorites(ids: string[]): void {
  currentFavoriteIds = ids;
  const entries = ids
    .map((id) => termsById.get(id))
    .filter((entry): entry is TermEntry => entry !== undefined);

  favoriteList.replaceChildren(...entries.map(createFavoriteItem));
  favoriteList.hidden = entries.length === 0;
  emptyMessage.hidden = entries.length !== 0;
  count.textContent = `${entries.length}件`;
  clearButton.disabled = ids.length === 0;
}

function createFavoriteItem(entry: TermEntry): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'favorite-item';

  const body = document.createElement('div');
  body.className = 'favorite-body';

  const term = document.createElement('h2');
  term.textContent = entry.term;

  const description = document.createElement('p');
  description.textContent = entry.short;

  body.append(term, description);

  if (entry.link) {
    const link = document.createElement('a');
    link.href = entry.link;
    link.target = '_blank';
    link.rel = 'noreferrer noopener';
    link.textContent = '詳しく';
    body.append(link);
  }

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'remove-favorite';
  removeButton.textContent = '削除';
  removeButton.setAttribute('aria-label', `${entry.term}をお気に入りから削除`);
  removeButton.addEventListener('click', async () => {
    removeButton.disabled = true;
    hideError();
    try {
      await removeFavorite(entry.id);
      renderFavorites(currentFavoriteIds.filter((id) => id !== entry.id));
    } catch (error: unknown) {
      showError(`${entry.term}を削除できませんでした。`, error);
      removeButton.disabled = false;
    }
  });

  item.append(body, removeButton);
  return item;
}

function requireElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: #${id}`);
  return element as T;
}

function hideError(): void {
  errorMessage.hidden = true;
  errorMessage.textContent = '';
}

function showError(message: string, error: unknown): void {
  console.error(`TechTerm: ${message}`, error);
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

const categoryList = requireElement<HTMLDivElement>('term-categories');
const settingsStatus = requireElement<HTMLParagraphElement>('settings-status');
const settingsError = requireElement<HTMLParagraphElement>('settings-error');
let categorySettings = defaultCategorySettings();
const categoryInputs = new Map<TermCategory, HTMLInputElement>();
const savingCategories = new Set<TermCategory>();

for (const { id, label } of termCategories) {
  const row = document.createElement('label');
  row.className = 'category-row';
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.disabled = true;
  const name = document.createElement('span');
  name.textContent = label;
  const count = document.createElement('span');
  count.className = 'category-count';
  count.textContent = `${builtinTerms.filter((entry) => (entry.category ?? 'basics') === id).length}語`;
  row.append(input, name, count);
  categoryList.append(row);
  categoryInputs.set(id, input);
  input.addEventListener('change', async () => {
    const enabled = input.checked;
    savingCategories.add(id);
    input.disabled = true;
    settingsError.hidden = true;
    settingsStatus.textContent = '保存中…';
    try {
      await setCategoryEnabled(id, enabled);
      // 確定した表示状態はstorage.onChangedから反映する。
      settingsStatus.textContent = '保存しました。開いているページにも反映されます。';
    } catch (error: unknown) {
      input.checked = categorySettings[id];
      settingsStatus.textContent = '';
      settingsError.textContent = '表示設定を保存できませんでした。もう一度お試しください。';
      settingsError.hidden = false;
      console.error('TechTerm: 表示設定を保存できませんでした。', error);
    } finally {
      savingCategories.delete(id);
      input.disabled = false;
    }
  });
}

observeCategorySettings((settings) => {
  categorySettings = settings;
  for (const [id, input] of categoryInputs) {
    input.checked = settings[id];
    input.disabled = savingCategories.has(id);
  }
  const enabledCount = builtinTerms.filter((entry) => settings[entry.category ?? 'basics']).length;
  settingsStatus.textContent = `${enabledCount} / ${builtinTerms.length}語が有効`;
}, (error) => {
  settingsError.textContent = '表示設定を読み込めませんでした。';
  settingsError.hidden = false;
  console.error('TechTerm: 表示設定を読み込めませんでした。', error);
});
