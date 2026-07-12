export type ChallengePhase = 'predict' | 'repair' | 'explain' | 'transfer';

export interface ChallengeOption {
  readonly id: string;
  readonly label: string;
  readonly feedback: string;
}

interface BaseChallenge {
  readonly id: string;
  readonly phase: ChallengePhase;
  readonly title: string;
  readonly prompt: string;
  readonly context?: string;
  readonly hint: string;
  readonly successFeedback: string;
  readonly reflectionPrompt: string;
}

export interface ChoiceChallenge extends BaseChallenge {
  readonly kind: 'choice';
  readonly options: readonly ChallengeOption[];
  readonly correctOptionId: string;
}

export interface SelectManyChallenge extends BaseChallenge {
  readonly kind: 'select-many';
  readonly options: readonly ChallengeOption[];
  readonly correctOptionIds: readonly string[];
  readonly incompleteFeedback: string;
}

export interface OrderingItem {
  readonly id: string;
  readonly label: string;
}

export interface OrderingChallenge extends BaseChallenge {
  readonly kind: 'ordering';
  readonly items: readonly OrderingItem[];
  readonly correctOrder: readonly string[];
  readonly incorrectFeedback: string;
}

export interface MatchingPrompt {
  readonly id: string;
  readonly label: string;
  readonly correctChoiceId: string;
}

export interface MatchingChoice {
  readonly id: string;
  readonly label: string;
}

export interface MatchingChallenge extends BaseChallenge {
  readonly kind: 'matching';
  readonly prompts: readonly MatchingPrompt[];
  readonly choices: readonly MatchingChoice[];
  readonly incorrectFeedback: string;
}

export interface TextEntryChallenge extends BaseChallenge {
  readonly kind: 'text-entry';
  readonly answerLabel: string;
  readonly starterText?: string;
  readonly acceptedAnswers: readonly string[];
  readonly incorrectFeedback: string;
}

export type ChallengeDefinition =
  | ChoiceChallenge
  | SelectManyChallenge
  | OrderingChallenge
  | MatchingChallenge
  | TextEntryChallenge;

export interface LectureSource {
  readonly file: string;
  readonly pages: string;
}

export interface QuestDefinition {
  readonly id: string;
  readonly districtId: string;
  readonly sequence: number;
  readonly title: string;
  readonly shortTitle: string;
  readonly briefing: string;
  readonly objectives: readonly string[];
  readonly prerequisiteQuestIds: readonly string[];
  readonly challenge: ChallengeDefinition;
  readonly deepPracticeUrl?: string;
  readonly lectureSources: readonly LectureSource[];
  readonly isCapstone?: boolean;
}

export interface DistrictDefinition {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly questIds: readonly string[];
}

export interface ChallengeProgress {
  readonly attempts: number;
  readonly hintsUsed: number;
  readonly completedAt?: string;
  readonly reviewLevel: number;
}

export interface QuestGameProgress {
  readonly version: 1;
  readonly challenges: Readonly<Record<string, ChallengeProgress>>;
  readonly lastQuestId?: string;
}

export type ChallengeSubmission =
  | { readonly kind: 'choice'; readonly optionId: string }
  | { readonly kind: 'select-many'; readonly optionIds: readonly string[] }
  | { readonly kind: 'ordering'; readonly itemIds: readonly string[] }
  | { readonly kind: 'matching'; readonly choicesByPrompt: Readonly<Record<string, string>> }
  | { readonly kind: 'text-entry'; readonly answer: string };

export interface ChallengeEvaluation {
  readonly correct: boolean;
  readonly feedback: string;
}
