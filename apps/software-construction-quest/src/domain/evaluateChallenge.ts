import type {
  ChallengeDefinition,
  ChallengeEvaluation,
  ChallengeSubmission,
} from './types';

function sameMembers(actual: readonly string[], expected: readonly string[]) {
  if (actual.length !== expected.length) return false;
  const actualMembers = new Set(actual);
  return expected.every((member) => actualMembers.has(member));
}

function normalizeTextAnswer(answer: string) {
  return answer
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*([|;,(){}])\s*/g, '$1')
    .replace(/;$/, '')
    .toLowerCase();
}

function incompatibleSubmission(): ChallengeEvaluation {
  return {
    correct: false,
    feedback: 'Choose an answer using the controls provided for this mission.',
  };
}

export function evaluateChallenge(
  challenge: ChallengeDefinition,
  submission: ChallengeSubmission,
): ChallengeEvaluation {
  switch (challenge.kind) {
    case 'choice': {
      if (submission.kind !== challenge.kind) return incompatibleSubmission();
      const selectedOption = challenge.options.find(
        (option) => option.id === submission.optionId,
      );
      const correct = submission.optionId === challenge.correctOptionId;
      return {
        correct,
        feedback: correct
          ? challenge.successFeedback
          : selectedOption?.feedback ?? 'Select one of the available answers.',
      };
    }
    case 'select-many': {
      if (submission.kind !== challenge.kind) return incompatibleSubmission();
      const correct = sameMembers(submission.optionIds, challenge.correctOptionIds);
      return {
        correct,
        feedback: correct ? challenge.successFeedback : challenge.incompleteFeedback,
      };
    }
    case 'ordering': {
      if (submission.kind !== challenge.kind) return incompatibleSubmission();
      const correct = challenge.correctOrder.every(
        (itemId, index) => submission.itemIds[index] === itemId,
      );
      return {
        correct,
        feedback: correct ? challenge.successFeedback : challenge.incorrectFeedback,
      };
    }
    case 'matching': {
      if (submission.kind !== challenge.kind) return incompatibleSubmission();
      const correct = challenge.prompts.every(
        (prompt) => submission.choicesByPrompt[prompt.id] === prompt.correctChoiceId,
      );
      return {
        correct,
        feedback: correct ? challenge.successFeedback : challenge.incorrectFeedback,
      };
    }
    case 'text-entry': {
      if (submission.kind !== challenge.kind) return incompatibleSubmission();
      const normalizedAnswer = normalizeTextAnswer(submission.answer);
      const correct = challenge.acceptedAnswers.some(
        (answer) => normalizeTextAnswer(answer) === normalizedAnswer,
      );
      return {
        correct,
        feedback: correct ? challenge.successFeedback : challenge.incorrectFeedback,
      };
    }
  }
}

export function initialSubmissionFor(
  challenge: ChallengeDefinition,
): ChallengeSubmission {
  switch (challenge.kind) {
    case 'choice':
      return { kind: challenge.kind, optionId: '' };
    case 'select-many':
      return { kind: challenge.kind, optionIds: [] };
    case 'ordering':
      return { kind: challenge.kind, itemIds: challenge.items.map((item) => item.id) };
    case 'matching':
      return { kind: challenge.kind, choicesByPrompt: {} };
    case 'text-entry':
      return { kind: challenge.kind, answer: challenge.starterText ?? '' };
  }
}
