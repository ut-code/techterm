import { termCategories, type TermCategory } from '@techword/core';

const keyFor = (id: TermCategory): string => `termCategory.${id}`;
export type CategorySettings = Record<TermCategory, boolean>;
export const defaultCategorySettings = (): CategorySettings =>
  Object.fromEntries(termCategories.map(({ id }) => [id, true])) as CategorySettings;

/** カテゴリごとに保存し、別カテゴリの同時更新による上書きを防ぐ。 */
export async function setCategoryEnabled(id: TermCategory, enabled: boolean): Promise<void> {
  await chrome.storage.sync.set({ [keyFor(id)]: enabled });
}

/** 監視を先に開始し、初回読み込み中の変更も取りこぼさない。 */
export function observeCategorySettings(
  listener: (settings: CategorySettings) => void,
  onError: (error: unknown) => void,
): () => void {
  const settings = defaultCategorySettings();
  const changedDuringLoad = new Set<TermCategory>();
  let loading = true;
  let active = true;
  const handleChange = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area !== 'sync') return;
    let changed = false;
    for (const { id } of termCategories) {
      const update = changes[keyFor(id)];
      if (!update) continue;
      if (loading) changedDuringLoad.add(id);
      settings[id] = update.newValue !== false;
      changed = true;
    }
    if (changed && !loading) listener({ ...settings });
  };
  chrome.storage.onChanged.addListener(handleChange);
  void chrome.storage.sync.get(termCategories.map(({ id }) => keyFor(id)))
    .then((values) => {
      if (!active) return;
      for (const { id } of termCategories) {
        if (!changedDuringLoad.has(id)) settings[id] = values[keyFor(id)] !== false;
      }
      loading = false;
      listener({ ...settings });
    })
    .catch((error: unknown) => {
      if (!active) return;
      loading = false;
      listener({ ...settings });
      onError(error);
    });
  return () => {
    active = false;
    chrome.storage.onChanged.removeListener(handleChange);
  };
}
