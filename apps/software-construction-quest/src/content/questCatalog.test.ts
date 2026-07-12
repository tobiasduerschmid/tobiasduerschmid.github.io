import { describe, expect, it } from 'vitest';
import { evaluateChallenge } from '../domain/evaluateChallenge';
import type { ChallengeSubmission } from '../domain/types';
import { DISTRICTS, QUESTS } from './questCatalog';

const REQUIRED_LECTURE_FILES = [
  'L01_Intro.pdf',
  'L2-ShellScripting.pdf',
  'L3-PythonScripting.pdf',
  'L4-VersionControlGit.pdf',
  'L5-ClientServerNodeJS.pdf',
  'L6-UI_Dev_React.pdf',
  'L7-ModelingDesignPrinciples.pdf',
  'L8_Data_Management.pdf',
  'L9_Testing.pdf',
  'L10_Debugging_git.pdf',
  'L11_Security.pdf',
  'L12_Reuse.pdf',
  'L13_C_Make.pdf',
  'L14_Gen_AI.pdf',
  'L15_Interoperability.pdf',
  'L15_ManagingComplexity.pdf',
  'L16_ManagingComplexity.pdf',
  'L17_CleanCode.pdf',
  'L17_Code_Comprehension_API_Design.pdf',
  'L18_Code_Review.pdf',
  'L18_Process.pdf',
  'L19_Process.pdf',
  'L19_Summary.pdf',
  'L20_Summary.pdf',
] as const;

describe('quest catalog', () => {
  it('defines the complete 27-mission course journey with unique identifiers', () => {
    expect(QUESTS).toHaveLength(27);
    expect(new Set(QUESTS.map((quest) => quest.id)).size).toBe(QUESTS.length);
    expect(new Set(QUESTS.map((quest) => quest.challenge.id)).size).toBe(QUESTS.length);
    expect(QUESTS.map((quest) => quest.sequence)).toEqual(
      Array.from({ length: QUESTS.length }, (_, index) => index + 1),
    );
  });

  it('covers every supplied lecture deck in mission provenance', () => {
    const coveredFiles = new Set(
      QUESTS.flatMap((quest) => quest.lectureSources.map((source) => source.file)),
    );

    for (const lectureFile of REQUIRED_LECTURE_FILES) {
      expect(coveredFiles.has(lectureFile), `${lectureFile} should have a mission`).toBe(true);
    }
  });

  it('places every quest in exactly one matching district', () => {
    const districtQuestIds = DISTRICTS.flatMap((district) => district.questIds);
    expect(new Set(districtQuestIds).size).toBe(QUESTS.length);
    expect(new Set(districtQuestIds)).toEqual(new Set(QUESTS.map((quest) => quest.id)));

    for (const district of DISTRICTS) {
      for (const questId of district.questIds) {
        expect(QUESTS.find((quest) => quest.id === questId)?.districtId).toBe(district.id);
      }
    }
  });

  it('uses only valid earlier missions as recommended prerequisites', () => {
    const sequenceByQuestId = new Map(QUESTS.map((quest) => [quest.id, quest.sequence]));

    for (const quest of QUESTS) {
      for (const prerequisiteId of quest.prerequisiteQuestIds) {
        const prerequisiteSequence = sequenceByQuestId.get(prerequisiteId);
        expect(prerequisiteSequence, `${prerequisiteId} should exist`).toBeDefined();
        expect(prerequisiteSequence).toBeLessThan(quest.sequence);
      }
    }
  });

  it('keeps every challenge answer inside its declared control choices', () => {
    for (const { challenge } of QUESTS) {
      switch (challenge.kind) {
        case 'choice':
          expect(challenge.options.some((option) => option.id === challenge.correctOptionId)).toBe(true);
          break;
        case 'select-many': {
          const optionIds = new Set(challenge.options.map((option) => option.id));
          expect(challenge.correctOptionIds.every((optionId) => optionIds.has(optionId))).toBe(true);
          break;
        }
        case 'ordering':
          expect(new Set(challenge.correctOrder)).toEqual(
            new Set(challenge.items.map((item) => item.id)),
          );
          break;
        case 'matching': {
          const choiceIds = new Set(challenge.choices.map((choice) => choice.id));
          expect(challenge.prompts.every((prompt) => choiceIds.has(prompt.correctChoiceId))).toBe(true);
          break;
        }
        case 'text-entry':
          expect(challenge.acceptedAnswers.length).toBeGreaterThan(0);
          expect(challenge.acceptedAnswers.every((answer) => answer.trim().length > 0)).toBe(true);
          break;
      }
    }
  });

  it('accepts the authored solution for every mission', () => {
    for (const { challenge } of QUESTS) {
      let submission: ChallengeSubmission;
      switch (challenge.kind) {
        case 'choice':
          submission = { kind: challenge.kind, optionId: challenge.correctOptionId };
          break;
        case 'select-many':
          submission = { kind: challenge.kind, optionIds: challenge.correctOptionIds };
          break;
        case 'ordering':
          submission = { kind: challenge.kind, itemIds: challenge.correctOrder };
          break;
        case 'matching':
          submission = {
            kind: challenge.kind,
            choicesByPrompt: Object.fromEntries(
              challenge.prompts.map((prompt) => [prompt.id, prompt.correctChoiceId]),
            ),
          };
          break;
        case 'text-entry':
          submission = { kind: challenge.kind, answer: challenge.acceptedAnswers[0] ?? '' };
          break;
      }

      expect(
        evaluateChallenge(challenge, submission).correct,
        `${challenge.id} should accept its authored solution`,
      ).toBe(true);
    }
  });
});
