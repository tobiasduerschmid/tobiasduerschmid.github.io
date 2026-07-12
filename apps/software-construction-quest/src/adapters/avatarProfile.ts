const HERO_AVATAR_STORAGE_KEY = 'se-gym-hero-avatar';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const OPTION_NAME = /^[a-z0-9-]{1,80}$/;

export interface StudentAvatarProfile {
  readonly kind: 'human' | 'bruin';
  readonly skinColor: string;
  readonly hairColor: string;
  readonly eyeColor: string;
  readonly hairStyle: string;
  readonly bodyType: string;
  readonly outfitStyle: string;
  readonly suitColor: string;
  readonly capeColor: string;
  readonly accentColor: string;
}

export const DEFAULT_STUDENT_AVATAR: StudentAvatarProfile = {
  kind: 'human',
  skinColor: '#cf9e82',
  hairColor: '#1f140c',
  eyeColor: '#1f140c',
  hairStyle: 'short',
  bodyType: 'athletic',
  outfitStyle: 'super-suit',
  suitColor: '#1f6ebd',
  capeColor: '#15538f',
  accentColor: '#ffd100',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function colorOr(value: unknown, fallback: string) {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback;
}

function optionOr(value: unknown, fallback: string) {
  return typeof value === 'string' && OPTION_NAME.test(value) ? value : fallback;
}

export function readStudentAvatar(
  storage?: Storage,
): StudentAvatarProfile {
  try {
    const activeStorage = storage ?? window.localStorage;
    const rawAvatar = activeStorage.getItem(HERO_AVATAR_STORAGE_KEY);
    if (!rawAvatar) return DEFAULT_STUDENT_AVATAR;

    const parsed: unknown = JSON.parse(rawAvatar);
    if (!isRecord(parsed)) return DEFAULT_STUDENT_AVATAR;
    const appearance = isRecord(parsed.appearance) ? parsed.appearance : {};
    const body = isRecord(parsed.body) ? parsed.body : {};
    const outfit = isRecord(parsed.outfit) ? parsed.outfit : {};

    return {
      kind: parsed.kind === 'bruin' ? 'bruin' : 'human',
      skinColor: colorOr(appearance.skin, DEFAULT_STUDENT_AVATAR.skinColor),
      hairColor: colorOr(appearance.hairColor, DEFAULT_STUDENT_AVATAR.hairColor),
      eyeColor: colorOr(appearance.eyeColor, DEFAULT_STUDENT_AVATAR.eyeColor),
      hairStyle: optionOr(appearance.hairStyle, DEFAULT_STUDENT_AVATAR.hairStyle),
      bodyType: optionOr(body.type, DEFAULT_STUDENT_AVATAR.bodyType),
      outfitStyle: optionOr(outfit.style, DEFAULT_STUDENT_AVATAR.outfitStyle),
      suitColor: colorOr(outfit.suit, DEFAULT_STUDENT_AVATAR.suitColor),
      capeColor: colorOr(outfit.capeOuter, DEFAULT_STUDENT_AVATAR.capeColor),
      accentColor: colorOr(outfit.capeInner, DEFAULT_STUDENT_AVATAR.accentColor),
    };
  } catch {
    return DEFAULT_STUDENT_AVATAR;
  }
}
