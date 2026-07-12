import { useCallback, useRef, useState } from 'react';
import type { ProgressRepository } from '../adapters/progressRepository';
import { EMPTY_PROGRESS, recordAttempt, rememberQuest } from '../domain/progress';
import type { QuestGameProgress } from '../domain/types';

export type PersistenceState = 'saved' | 'unavailable';

export function useQuestProgress(repository: ProgressRepository) {
  const [progress, setProgress] = useState(() => repository.load());
  const progressRef = useRef(progress);
  const [persistenceState, setPersistenceState] = useState<PersistenceState>('saved');

  const persist = useCallback(
    (nextProgress: QuestGameProgress) => {
      progressRef.current = nextProgress;
      setProgress(nextProgress);
      setPersistenceState(repository.save(nextProgress) ? 'saved' : 'unavailable');
    },
    [repository],
  );

  const selectQuest = useCallback(
    (questId: string) => {
      persist(rememberQuest(progressRef.current, questId));
    },
    [persist],
  );

  const submitAttempt = useCallback(
    ({
      questId,
      challengeId,
      correct,
      hintUsed,
    }: {
      questId: string;
      challengeId: string;
      correct: boolean;
      hintUsed: boolean;
    }) => {
      const attempted = recordAttempt(progressRef.current, {
        challengeId,
        correct,
        hintUsed,
        occurredAt: new Date().toISOString(),
      });
      persist(rememberQuest(attempted, questId));
    },
    [persist],
  );

  const resetProgress = useCallback(() => {
    const cleared = repository.clear();
    progressRef.current = EMPTY_PROGRESS;
    setProgress(EMPTY_PROGRESS);
    setPersistenceState(cleared ? 'saved' : 'unavailable');
  }, [repository]);

  return {
    progress,
    persistenceState,
    selectQuest,
    submitAttempt,
    resetProgress,
  };
}
