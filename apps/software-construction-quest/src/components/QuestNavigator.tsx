import type { DistrictDefinition, QuestDefinition } from '../domain/types';

interface QuestNavigatorProps {
  readonly districts: readonly DistrictDefinition[];
  readonly quests: readonly QuestDefinition[];
  readonly selectedQuestId: string;
  readonly completedQuestIds: ReadonlySet<string>;
  readonly capstoneAvailable: boolean;
  readonly onSelectQuest: (questId: string) => void;
}

export function QuestNavigator({
  districts,
  quests,
  selectedQuestId,
  completedQuestIds,
  capstoneAvailable,
  onSelectQuest,
}: QuestNavigatorProps) {
  const questsById = new Map(quests.map((quest) => [quest.id, quest]));

  return (
    <section className="scq-quest-map" aria-labelledby="scq-quest-map-title">
      <div className="scq-section-heading">
        <p className="scq-eyebrow">Choose your route</p>
        <h2 id="scq-quest-map-title">Quest map</h2>
      </div>
      <p>
        Prerequisites show the recommended route. Every regular mission remains
        available so you can choose the practice you need.
      </p>
      <div className="scq-district-list">
        {districts.map((district) => {
          const districtQuests = district.questIds
            .map((questId) => questsById.get(questId))
            .filter((quest): quest is QuestDefinition => quest !== undefined);
          const districtComplete = districtQuests.filter((quest) =>
            completedQuestIds.has(quest.id),
          ).length;

          return (
            <section
              className="scq-district"
              aria-labelledby={`scq-district-${district.id}`}
              key={district.id}
            >
              <div className="scq-district__heading">
                <h3 id={`scq-district-${district.id}`}>{district.title}</h3>
                <span>
                  {districtComplete}/{districtQuests.length} restored
                </span>
              </div>
              <p>{district.description}</p>
              <ol className="scq-quest-list">
                {districtQuests.map((quest) => {
                  const complete = completedQuestIds.has(quest.id);
                  const lockedCapstone = quest.isCapstone === true && !capstoneAvailable;
                  return (
                    <li key={quest.id}>
                      <button
                        type="button"
                        className="scq-quest-button"
                        aria-pressed={selectedQuestId === quest.id}
                        onClick={() => onSelectQuest(quest.id)}
                      >
                        <span className="scq-quest-button__sequence">
                          Mission {quest.sequence}
                        </span>
                        <span className="scq-quest-button__title">
                          {quest.shortTitle}
                        </span>
                        <span className="scq-quest-button__state">
                          {complete
                            ? 'Complete'
                            : lockedCapstone
                              ? 'Capstone preview'
                              : 'Ready'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </section>
  );
}
