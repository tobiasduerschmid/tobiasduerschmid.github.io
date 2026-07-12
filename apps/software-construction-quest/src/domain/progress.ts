import type {
  ChallengeProgress,
  QuestDefinition,
  QuestGameProgress,
} from './types';

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const REVIEW_INTERVAL_DAYS = [0, 1, 3, 7, 14] as const;

export const EMPTY_PROGRESS: QuestGameProgress = {
  version: 1,
  challenges: {},
};

interface AttemptResult {
  readonly challengeId: string;
  readonly correct: boolean;
  readonly hintUsed: boolean;
  readonly occurredAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeChallengeProgress(value: unknown): ChallengeProgress | null {
  if (!isRecord(value)) return null;
  const attempts = value.attempts;
  const hintsUsed = value.hintsUsed;
  const reviewLevel = value.reviewLevel;
  const completedAt = value.completedAt;

  if (
    !Number.isInteger(attempts) ||
    Number(attempts) < 0 ||
    !Number.isInteger(hintsUsed) ||
    Number(hintsUsed) < 0 ||
    !Number.isInteger(reviewLevel) ||
    Number(reviewLevel) < 0 ||
    Number(reviewLevel) >= REVIEW_INTERVAL_DAYS.length ||
    (completedAt !== undefined && typeof completedAt !== 'string')
  ) {
    return null;
  }

  return {
    attempts: Number(attempts),
    hintsUsed: Number(hintsUsed),
    reviewLevel: Number(reviewLevel),
    ...(typeof completedAt === 'string' ? { completedAt } : {}),
  };
}

export function normalizeProgress(value: unknown): QuestGameProgress {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.challenges)) {
    return EMPTY_PROGRESS;
  }

  const challenges: Record<string, ChallengeProgress> = {};
  for (const [challengeId, rawProgress] of Object.entries(value.challenges)) {
    const normalized = normalizeChallengeProgress(rawProgress);
    if (normalized) challenges[challengeId] = normalized;
  }

  const lastQuestId = typeof value.lastQuestId === 'string' ? value.lastQuestId : undefined;
  return {
    version: 1,
    challenges,
    ...(lastQuestId ? { lastQuestId } : {}),
  };
}

export function recordAttempt(
  progress: QuestGameProgress,
  result: AttemptResult,
): QuestGameProgress {
  const previous = progress.challenges[result.challengeId] ?? {
    attempts: 0,
    hintsUsed: 0,
    reviewLevel: 0,
  };
  const wasComplete = previous.completedAt !== undefined;
  const nextReviewLevel = result.correct
    ? Math.min(previous.reviewLevel + 1, REVIEW_INTERVAL_DAYS.length - 1)
    : Math.max(previous.reviewLevel - (wasComplete ? 1 : 0), 0);

  const updated: ChallengeProgress = {
    attempts: previous.attempts + 1,
    hintsUsed: previous.hintsUsed + (result.hintUsed ? 1 : 0),
    reviewLevel: nextReviewLevel,
    ...(result.correct
      ? { completedAt: result.occurredAt }
      : previous.completedAt
        ? { completedAt: previous.completedAt }
        : {}),
  };

  return {
    ...progress,
    challenges: {
      ...progress.challenges,
      [result.challengeId]: updated,
    },
  };
}

export function rememberQuest(
  progress: QuestGameProgress,
  questId: string,
): QuestGameProgress {
  return { ...progress, lastQuestId: questId };
}

export function isChallengeComplete(
  progress: QuestGameProgress,
  challengeId: string,
) {
  return progress.challenges[challengeId]?.completedAt !== undefined;
}

export function isQuestComplete(
  progress: QuestGameProgress,
  quest: QuestDefinition,
) {
  return isChallengeComplete(progress, quest.challenge.id);
}

export function completedQuestCount(
  progress: QuestGameProgress,
  quests: readonly QuestDefinition[],
) {
  return quests.filter((quest) => isQuestComplete(progress, quest)).length;
}

export function dueChallengeIds(
  progress: QuestGameProgress,
  now: Date,
) {
  const nowTime = now.getTime();
  return Object.entries(progress.challenges)
    .filter(([, challenge]) => {
      if (!challenge.completedAt) return false;
      const completedTime = Date.parse(challenge.completedAt);
      if (!Number.isFinite(completedTime)) return false;
      const interval = REVIEW_INTERVAL_DAYS[challenge.reviewLevel] ?? 14;
      return nowTime - completedTime >= interval * DAY_IN_MILLISECONDS;
    })
    .map(([challengeId]) => challengeId);
}
