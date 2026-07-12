import { describe, expect, it } from 'vitest';
import { evaluateChallenge } from './evaluateChallenge';
import type { ChallengeDefinition } from './types';

const baseChallenge = {
  id: 'test-challenge',
  phase: 'repair' as const,
  title: 'Test challenge',
  prompt: 'Repair the test fixture.',
  hint: 'Inspect the contract.',
  successFeedback: 'The contract is preserved.',
  reflectionPrompt: 'What made this answer safe?',
};

describe('evaluateChallenge', () => {
  it('uses the selected distractor feedback for an incorrect choice', () => {
    const challenge: ChallengeDefinition = {
      ...baseChallenge,
      kind: 'choice',
      correctOptionId: 'safe',
      options: [
        { id: 'safe', label: 'Safe change', feedback: 'This is safe.' },
        { id: 'risky', label: 'Risky change', feedback: 'This rewrites shared history.' },
      ],
    };

    const result = evaluateChallenge(challenge, {
      kind: 'choice',
      optionId: 'risky',
    });

    expect(result).toEqual({
      correct: false,
      feedback: 'This rewrites shared history.',
    });
  });

  it('accepts a select-many answer only when it contains exactly the required options', () => {
    const challenge: ChallengeDefinition = {
      ...baseChallenge,
      kind: 'select-many',
      correctOptionIds: ['boundary', 'empty'],
      incompleteFeedback: 'The evidence set still misses a meaningful input partition.',
      options: [
        { id: 'boundary', label: 'Boundary', feedback: '' },
        { id: 'empty', label: 'Empty input', feedback: '' },
        { id: 'random', label: 'Random middle value', feedback: '' },
      ],
    };

    expect(
      evaluateChallenge(challenge, {
        kind: 'select-many',
        optionIds: ['empty', 'boundary'],
      }).correct,
    ).toBe(true);
    expect(
      evaluateChallenge(challenge, {
        kind: 'select-many',
        optionIds: ['empty', 'boundary', 'random'],
      }).correct,
    ).toBe(false);
  });

  it('normalizes harmless whitespace while keeping text-entry answers exact', () => {
    const challenge: ChallengeDefinition = {
      ...baseChallenge,
      kind: 'text-entry',
      answerLabel: 'Command',
      acceptedAnswers: ['grep ERROR server.log | sort | uniq -c'],
      incorrectFeedback: 'The pipeline does not yet count each distinct error line.',
    };

    expect(
      evaluateChallenge(challenge, {
        kind: 'text-entry',
        answer: '  grep ERROR server.log|sort|uniq -c;  ',
      }).correct,
    ).toBe(true);
    expect(
      evaluateChallenge(challenge, {
        kind: 'text-entry',
        answer: 'grep ERROR server.log | uniq -c',
      }).correct,
    ).toBe(false);
  });
});
