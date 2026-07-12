import { describe, expect, it, vi } from 'vitest';
import { EMPTY_PROGRESS } from '../domain/progress';
import {
  createBrowserProgressRepository,
  QUEST_PROGRESS_STORAGE_KEY,
} from './progressRepository';

class MemoryStorage implements Storage {
  private readonly entries = new Map<string, string>();

  get length() {
    return this.entries.size;
  }

  clear() {
    this.entries.clear();
  }

  getItem(key: string) {
    return this.entries.get(key) ?? null;
  }

  key(index: number) {
    return [...this.entries.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.entries.delete(key);
  }

  setItem(key: string, value: string) {
    this.entries.set(key, value);
  }
}

describe('browser progress repository', () => {
  it('round-trips versioned quest progress and clears only the quest key', () => {
    const storage = new MemoryStorage();
    storage.setItem('se-gym-hero-avatar', '{"kind":"human"}');
    const repository = createBrowserProgressRepository(storage);
    const progress = {
      version: 1 as const,
      challenges: {
        acceptance: {
          attempts: 2,
          hintsUsed: 1,
          completedAt: '2026-07-11T12:00:00.000Z',
          reviewLevel: 1,
        },
      },
      lastQuestId: 'story-forge',
    };

    expect(repository.save(progress)).toBe(true);
    expect(repository.load()).toEqual(progress);
    expect(repository.clear()).toBe(true);
    expect(repository.load()).toEqual(EMPTY_PROGRESS);
    expect(storage.getItem('se-gym-hero-avatar')).not.toBeNull();
  });

  it('treats malformed or unknown-version data as empty progress', () => {
    const storage = new MemoryStorage();
    const repository = createBrowserProgressRepository(storage);

    storage.setItem(QUEST_PROGRESS_STORAGE_KEY, 'not json');
    expect(repository.load()).toEqual(EMPTY_PROGRESS);

    storage.setItem(
      QUEST_PROGRESS_STORAGE_KEY,
      JSON.stringify({ version: 99, challenges: { unsafe: true } }),
    );
    expect(repository.load()).toEqual(EMPTY_PROGRESS);
  });

  it('degrades safely when the browser blocks the storage property itself', () => {
    const blockedWindow = Object.defineProperty({}, 'localStorage', {
      get() {
        throw new DOMException('Storage access blocked', 'SecurityError');
      },
    });
    vi.stubGlobal('window', blockedWindow);

    try {
      const repository = createBrowserProgressRepository();
      expect(repository.load()).toEqual(EMPTY_PROGRESS);
      expect(repository.save(EMPTY_PROGRESS)).toBe(false);
      expect(repository.clear()).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
