import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_STUDENT_AVATAR, readStudentAvatar } from './avatarProfile';

class AvatarStorage implements Storage {
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

describe('SE Gym avatar adapter', () => {
  it('maps the saved SE Gym schema into the read-only student profile', () => {
    const storage = new AvatarStorage();
    storage.setItem(
      'se-gym-hero-avatar',
      JSON.stringify({
        kind: 'bruin',
        appearance: {
          skin: '#875a50',
          hairColor: '#3d2818',
          hairStyle: 'bald',
          eyeColor: '#1f140c',
        },
        body: { type: 'athletic' },
        outfit: {
          style: 'super-suit',
          suit: '#2774ae',
          capeOuter: '#005587',
          capeInner: '#ffd100',
        },
      }),
    );

    expect(readStudentAvatar(storage)).toEqual({
      kind: 'bruin',
      skinColor: '#875a50',
      hairColor: '#3d2818',
      hairStyle: 'bald',
      eyeColor: '#1f140c',
      bodyType: 'athletic',
      outfitStyle: 'super-suit',
      suitColor: '#2774ae',
      capeColor: '#005587',
      accentColor: '#ffd100',
    });
  });

  it('uses the established defaults for corrupt or untrusted fields', () => {
    const storage = new AvatarStorage();
    storage.setItem(
      'se-gym-hero-avatar',
      JSON.stringify({
        kind: 'robot',
        appearance: { skin: 'url(javascript:alert(1))', hairStyle: '../unsafe' },
        body: { type: '<script>' },
      }),
    );

    expect(readStudentAvatar(storage)).toEqual(DEFAULT_STUDENT_AVATAR);
  });

  it('falls back when the browser blocks access to the storage property itself', () => {
    const blockedWindow = Object.defineProperty({}, 'localStorage', {
      get() {
        throw new DOMException('Storage access blocked', 'SecurityError');
      },
    });
    vi.stubGlobal('window', blockedWindow);

    try {
      expect(readStudentAvatar()).toEqual(DEFAULT_STUDENT_AVATAR);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
