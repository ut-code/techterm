import { builtinTerms, type TermEntry } from '@techword/core';
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
