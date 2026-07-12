import { EMPTY_PROGRESS, normalizeProgress } from '../domain/progress';
import type { QuestGameProgress } from '../domain/types';

export const QUEST_PROGRESS_STORAGE_KEY = 'software-construction-quest-progress';

export interface ProgressRepository {
  load(): QuestGameProgress;
  save(progress: QuestGameProgress): boolean;
  clear(): boolean;
}

export function createBrowserProgressRepository(
  storage?: Storage,
): ProgressRepository {
  return {
    load() {
      try {
        const activeStorage = storage ?? window.localStorage;
        const rawProgress = activeStorage.getItem(QUEST_PROGRESS_STORAGE_KEY);
        return rawProgress ? normalizeProgress(JSON.parse(rawProgress)) : EMPTY_PROGRESS;
      } catch {
        return EMPTY_PROGRESS;
      }
    },
    save(progress) {
      try {
        const activeStorage = storage ?? window.localStorage;
        activeStorage.setItem(QUEST_PROGRESS_STORAGE_KEY, JSON.stringify(progress));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        const activeStorage = storage ?? window.localStorage;
        activeStorage.removeItem(QUEST_PROGRESS_STORAGE_KEY);
        return true;
      } catch {
        return false;
      }
    },
  };
}
