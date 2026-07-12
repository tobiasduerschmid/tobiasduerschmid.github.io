import { useMemo, useState } from 'react';
import { readStudentAvatar } from './adapters/avatarProfile';
import { createBrowserProgressRepository } from './adapters/progressRepository';
import { browserSupportsWebGL } from './adapters/webglSupport';
import { AppHeader } from './components/AppHeader';
import { ChallengeWorkspace } from './components/ChallengeWorkspace';
import { QuestNavigator } from './components/QuestNavigator';
import { WorldPanel } from './components/WorldPanel';
import {
  CAPSTONE_REQUIRED_QUESTS,
  DISTRICTS,
  QUEST_BY_ID,
  QUESTS,
} from './content/questCatalog';
import {
  completedQuestCount,
  dueChallengeIds,
  isQuestComplete,
} from './domain/progress';
import type { DistrictDefinition, QuestDefinition } from './domain/types';
import { useQuestProgress } from './hooks/useQuestProgress';
import { useReducedMotion } from './hooks/useReducedMotion';

const ALL_QUESTS: readonly QuestDefinition[] = QUESTS;
const ALL_DISTRICTS: readonly DistrictDefinition[] = DISTRICTS;

export function App() {
  const repository = useMemo(() => createBrowserProgressRepository(), []);
  const avatar = useMemo(() => readStudentAvatar(), []);
  const webglSupported = useMemo(browserSupportsWebGL, []);
  const reducedMotion = useReducedMotion();
  const {
    progress,
    persistenceState,
    selectQuest,
    submitAttempt,
    resetProgress,
  } = useQuestProgress(repository);
  const [worldVisible, setWorldVisible] = useState(true);
  const [animationPaused, setAnimationPaused] = useState(false);
  const [resetRequested, setResetRequested] = useState(false);

  const selectedQuest =
    (progress.lastQuestId ? QUEST_BY_ID.get(progress.lastQuestId) : undefined) ?? QUESTS[0];
  const completedQuestIds = useMemo(
    () =>
      new Set(
        ALL_QUESTS.filter((quest) => isQuestComplete(progress, quest)).map(
          (quest) => quest.id,
        ),
      ),
    [progress],
  );
  const completedQuests = completedQuestCount(progress, ALL_QUESTS);
  const completedRegularQuests = ALL_QUESTS.filter(
    (quest) => quest.isCapstone !== true && completedQuestIds.has(quest.id),
  ).length;
  const capstoneAvailable = completedRegularQuests >= CAPSTONE_REQUIRED_QUESTS;
  const dueIds = dueChallengeIds(progress, new Date());
  const dueQuestIds = ALL_QUESTS.filter((quest) => dueIds.includes(quest.challenge.id)).map(
    (quest) => quest.id,
  );
  const selectedDistrict = ALL_DISTRICTS.find(
    (district) => district.id === selectedQuest.districtId,
  );
  const selectedDistrictQuests = selectedDistrict?.questIds
    .map((questId) => QUEST_BY_ID.get(questId))
    .filter((quest) => quest !== undefined) ?? [];
  const completedDistrictIds = useMemo(
    () =>
      new Set(
        ALL_DISTRICTS.filter((district) =>
          district.questIds.every((questId) => completedQuestIds.has(questId)),
        ).map((district) => district.id),
      ),
    [completedQuestIds],
  );
  const prerequisiteTitles = selectedQuest.prerequisiteQuestIds.flatMap((questId) => {
    const title = QUEST_BY_ID.get(questId)?.shortTitle;
    return title ? [title] : [];
  });

  function chooseQuest(questId: string) {
    selectQuest(questId);
    setResetRequested(false);
  }

  function chooseDueReview() {
    const nextDueQuestId = dueQuestIds[0];
    if (nextDueQuestId) chooseQuest(nextDueQuestId);
  }

  return (
    <div className="scq-app" aria-labelledby="scq-title">
      <AppHeader
        completedQuests={completedQuests}
        totalQuests={ALL_QUESTS.length}
        dueReviews={dueQuestIds.length}
        onReviewDue={chooseDueReview}
        onRequestReset={() => setResetRequested(true)}
      />

      {persistenceState === 'unavailable' ? (
        <p className="scq-notice scq-notice--warning" role="status">
          This browser is blocking local progress storage. You can keep playing in
          this tab, but completed missions may not survive a reload.
        </p>
      ) : null}

      {resetRequested ? (
        <section className="scq-reset-panel" aria-labelledby="scq-reset-title">
          <h2 id="scq-reset-title">Reset all quest progress?</h2>
          <p>
            This removes local mission attempts, completions, and review dates. Your
            SE Gym hero remains unchanged.
          </p>
          <div className="scq-inline-actions">
            <button
              type="button"
              className="scq-button scq-button--danger"
              onClick={() => {
                resetProgress();
                setResetRequested(false);
              }}
            >
              Delete quest progress
            </button>
            <button
              type="button"
              className="scq-button scq-button--quiet"
              onClick={() => setResetRequested(false)}
            >
              Keep my progress
            </button>
          </div>
        </section>
      ) : null}

      <WorldPanel
        avatar={avatar}
        districts={ALL_DISTRICTS}
        selectedDistrictId={selectedQuest.districtId}
        completedDistrictIds={completedDistrictIds}
        selectedDistrictComplete={selectedDistrictQuests.filter((quest) =>
          completedQuestIds.has(quest.id),
        ).length}
        selectedDistrictTotal={selectedDistrictQuests.length}
        webglSupported={webglSupported}
        worldVisible={worldVisible}
        animationPaused={animationPaused}
        reducedMotion={reducedMotion}
        onToggleWorld={() => setWorldVisible((visible) => !visible)}
        onToggleAnimation={() => setAnimationPaused((paused) => !paused)}
      />

      <div className="scq-learning-layout">
        <QuestNavigator
          districts={ALL_DISTRICTS}
          quests={ALL_QUESTS}
          selectedQuestId={selectedQuest.id}
          completedQuestIds={completedQuestIds}
          capstoneAvailable={capstoneAvailable}
          onSelectQuest={chooseQuest}
        />
        <ChallengeWorkspace
          key={selectedQuest.id}
          quest={selectedQuest}
          prerequisiteTitles={prerequisiteTitles}
          isComplete={completedQuestIds.has(selectedQuest.id)}
          capstoneAvailable={capstoneAvailable}
          capstoneRequiredQuests={CAPSTONE_REQUIRED_QUESTS}
          completedQuestCount={completedRegularQuests}
          onAttempt={({ correct, hintUsed }) =>
            submitAttempt({
              questId: selectedQuest.id,
              challengeId: selectedQuest.challenge.id,
              correct,
              hintUsed,
            })
          }
        />
      </div>
    </div>
  );
}
