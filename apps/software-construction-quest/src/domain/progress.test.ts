import { describe, expect, it } from 'vitest';
import {
  EMPTY_PROGRESS,
  dueChallengeIds,
  normalizeProgress,
  recordAttempt,
} from './progress';

describe('quest progress', () => {
  it('records attempts, hint use, and first completion without mutating prior state', () => {
    const completed = recordAttempt(EMPTY_PROGRESS, {
      challengeId: 'shell-pipeline',
      correct: true,
      hintUsed: true,
      occurredAt: '2026-07-11T12:00:00.000Z',
    });

    expect(EMPTY_PROGRESS.challenges['shell-pipeline']).toBeUndefined();
    expect(completed.challenges['shell-pipeline']).toEqual({
      attempts: 1,
      hintsUsed: 1,
      completedAt: '2026-07-11T12:00:00.000Z',
      reviewLevel: 1,
    });
  });

  it('keeps completed work while lowering the review interval after a failed review', () => {
    const firstCompletion = recordAttempt(EMPTY_PROGRESS, {
      challengeId: 'git-recovery',
      correct: true,
      hintUsed: false,
      occurredAt: '2026-07-01T12:00:00.000Z',
    });

    const failedReview = recordAttempt(firstCompletion, {
      challengeId: 'git-recovery',
      correct: false,
      hintUsed: false,
      occurredAt: '2026-07-03T12:00:00.000Z',
    });

    expect(failedReview.challenges['git-recovery']).toEqual({
      attempts: 2,
      hintsUsed: 0,
      completedAt: '2026-07-01T12:00:00.000Z',
      reviewLevel: 0,
    });
  });

  it('marks a completed challenge due after its current spacing interval', () => {
    const completed = recordAttempt(EMPTY_PROGRESS, {
      challengeId: 'data-transaction',
      correct: true,
      hintUsed: false,
      occurredAt: '2026-07-10T12:00:00.000Z',
    });

    expect(dueChallengeIds(completed, new Date('2026-07-11T11:59:59.000Z'))).toEqual([]);
    expect(dueChallengeIds(completed, new Date('2026-07-11T12:00:00.000Z'))).toEqual([
      'data-transaction',
    ]);
  });

  it('rejects incompatible persisted versions and keeps valid challenge records', () => {
    expect(normalizeProgress({ version: 2, challenges: {} })).toEqual(EMPTY_PROGRESS);
    expect(
      normalizeProgress({
        version: 1,
        challenges: {
          valid: { attempts: 2, hintsUsed: 1, reviewLevel: 2 },
          invalid: { attempts: -1, hintsUsed: 0, reviewLevel: 0 },
        },
      }),
    ).toEqual({
      version: 1,
      challenges: {
        valid: { attempts: 2, hintsUsed: 1, reviewLevel: 2 },
      },
    });
  });
});
