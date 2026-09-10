export const FAVORITES_STORAGE_KEY = 'favoriteTermIds';

type FavoriteIdsListener = (ids: string[]) => void;

function sanitizeFavoriteIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0)),
  ];
}

export async function getFavoriteIds(): Promise<string[]> {
  const result = await chrome.storage.sync.get(FAVORITES_STORAGE_KEY);
  return sanitizeFavoriteIds(result[FAVORITES_STORAGE_KEY]);
}

async function setFavoriteIds(ids: string[]): Promise<void> {
  await chrome.storage.sync.set({
    [FAVORITES_STORAGE_KEY]: sanitizeFavoriteIds(ids),
  });
}

export async function toggleFavorite(id: string): Promise<boolean> {
  const ids = await getFavoriteIds();
  const nextIsFavorite = !ids.includes(id);
  const nextIds = nextIsFavorite
    ? [...ids, id]
    : ids.filter((currentId) => currentId !== id);

  await setFavoriteIds(nextIds);
  return nextIsFavorite;
}

export async function removeFavorite(id: string): Promise<void> {
  const ids = await getFavoriteIds();
  await setFavoriteIds(ids.filter((currentId) => currentId !== id));
}

export async function clearFavorites(): Promise<void> {
  await setFavoriteIds([]);
}

export function watchFavoriteIds(listener: FavoriteIdsListener): () => void {
  const handleChange = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'sync') return;
    const change = changes[FAVORITES_STORAGE_KEY];
    if (!change) return;
    listener(sanitizeFavoriteIds(change.newValue));
  };

  chrome.storage.onChanged.addListener(handleChange);
  return () => chrome.storage.onChanged.removeListener(handleChange);
}
