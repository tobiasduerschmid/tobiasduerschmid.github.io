import { useId, useState, type FormEvent } from 'react';
import { evaluateChallenge, initialSubmissionFor } from '../domain/evaluateChallenge';
import type {
  ChallengeDefinition,
  ChallengeEvaluation,
  ChallengeSubmission,
  QuestDefinition,
} from '../domain/types';

interface ChallengeWorkspaceProps {
  readonly quest: QuestDefinition;
  readonly prerequisiteTitles: readonly string[];
  readonly isComplete: boolean;
  readonly capstoneAvailable: boolean;
  readonly capstoneRequiredQuests: number;
  readonly completedQuestCount: number;
  readonly onAttempt: (result: { correct: boolean; hintUsed: boolean }) => void;
}

function phaseLabel(phase: ChallengeDefinition['phase']) {
  return {
    predict: 'Predict',
    repair: 'Repair',
    explain: 'Explain',
    transfer: 'Transfer',
  }[phase];
}

function moveItem(itemIds: readonly string[], index: number, offset: -1 | 1) {
  const targetIndex = index + offset;
  if (targetIndex < 0 || targetIndex >= itemIds.length) return itemIds;
  const next = [...itemIds];
  const currentItem = next[index];
  const targetItem = next[targetIndex];
  if (currentItem === undefined || targetItem === undefined) return itemIds;
  next[index] = targetItem;
  next[targetIndex] = currentItem;
  return next;
}

function submissionIsReady(
  challenge: ChallengeDefinition,
  submission: ChallengeSubmission,
) {
  switch (challenge.kind) {
    case 'choice':
      return submission.kind === challenge.kind && submission.optionId !== '';
    case 'select-many':
      return submission.kind === challenge.kind && submission.optionIds.length > 0;
    case 'ordering':
      return submission.kind === challenge.kind;
    case 'matching':
      return submission.kind === challenge.kind &&
        challenge.prompts.every((prompt) => submission.choicesByPrompt[prompt.id]);
    case 'text-entry':
      return submission.kind === challenge.kind && submission.answer.trim() !== '';
  }
}

function ChallengeControls({
  challenge,
  submission,
  disabled,
  onChange,
}: {
  readonly challenge: ChallengeDefinition;
  readonly submission: ChallengeSubmission;
  readonly disabled: boolean;
  readonly onChange: (submission: ChallengeSubmission) => void;
}) {
  const controlId = useId();

  switch (challenge.kind) {
    case 'choice': {
      if (submission.kind !== challenge.kind) return null;
      return (
        <fieldset className="scq-fieldset" disabled={disabled}>
          <legend>{challenge.prompt}</legend>
          {challenge.options.map((option) => (
            <label className="scq-option" key={option.id}>
              <input
                type="radio"
                name={`${controlId}-choice`}
                value={option.id}
                checked={submission.optionId === option.id}
                onChange={() => onChange({ kind: challenge.kind, optionId: option.id })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
      );
    }
    case 'select-many': {
      if (submission.kind !== challenge.kind) return null;
      return (
        <fieldset className="scq-fieldset" disabled={disabled}>
          <legend>{challenge.prompt}</legend>
          <p>Select all that apply.</p>
          {challenge.options.map((option) => {
            const checked = submission.optionIds.includes(option.id);
            return (
              <label className="scq-option" key={option.id}>
                <input
                  type="checkbox"
                  value={option.id}
                  checked={checked}
                  onChange={() => {
                    const optionIds = checked
                      ? submission.optionIds.filter((optionId) => optionId !== option.id)
                      : [...submission.optionIds, option.id];
                    onChange({ kind: challenge.kind, optionIds });
                  }}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </fieldset>
      );
    }
    case 'ordering': {
      if (submission.kind !== challenge.kind) return null;
      const itemById = new Map(challenge.items.map((item) => [item.id, item]));
      return (
        <fieldset className="scq-fieldset" disabled={disabled}>
          <legend>{challenge.prompt}</legend>
          <p>Use the move buttons to arrange the steps. Dragging is not required.</p>
          <ol className="scq-ordering-list">
            {submission.itemIds.map((itemId, index) => {
              const item = itemById.get(itemId);
              if (!item) return null;
              return (
                <li key={item.id}>
                  <span>{item.label}</span>
                  <span className="scq-ordering-actions">
                    <button
                      type="button"
                      className="scq-button scq-button--quiet"
                      disabled={index === 0 || disabled}
                      onClick={() =>
                        onChange({
                          kind: challenge.kind,
                          itemIds: moveItem(submission.itemIds, index, -1),
                        })
                      }
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      className="scq-button scq-button--quiet"
                      disabled={index === submission.itemIds.length - 1 || disabled}
                      onClick={() =>
                        onChange({
                          kind: challenge.kind,
                          itemIds: moveItem(submission.itemIds, index, 1),
                        })
                      }
                    >
                      Move down
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        </fieldset>
      );
    }
    case 'matching': {
      if (submission.kind !== challenge.kind) return null;
      return (
        <fieldset className="scq-fieldset" disabled={disabled}>
          <legend>{challenge.prompt}</legend>
          <div className="scq-matching-grid">
            {challenge.prompts.map((prompt) => {
              const selectId = `${controlId}-${prompt.id}`;
              return (
                <div className="scq-matching-row" key={prompt.id}>
                  <label htmlFor={selectId}>{prompt.label}</label>
                  <select
                    id={selectId}
                    value={submission.choicesByPrompt[prompt.id] ?? ''}
                    onChange={(event) =>
                      onChange({
                        kind: challenge.kind,
                        choicesByPrompt: {
                          ...submission.choicesByPrompt,
                          [prompt.id]: event.target.value,
                        },
                      })
                    }
                  >
                    <option value="">Choose a match</option>
                    {challenge.choices.map((choice) => (
                      <option key={choice.id} value={choice.id}>
                        {choice.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </fieldset>
      );
    }
    case 'text-entry': {
      if (submission.kind !== challenge.kind) return null;
      const inputId = `${controlId}-answer`;
      return (
        <fieldset className="scq-fieldset" disabled={disabled}>
          <legend>{challenge.prompt}</legend>
          <label htmlFor={inputId}>{challenge.answerLabel}</label>
          <textarea
            id={inputId}
            className="scq-text-entry"
            rows={4}
            value={submission.answer}
            onChange={(event) =>
              onChange({ kind: challenge.kind, answer: event.target.value })
            }
            spellCheck={false}
          />
        </fieldset>
      );
    }
  }
}

export function ChallengeWorkspace({
  quest,
  prerequisiteTitles,
  isComplete,
  capstoneAvailable,
  capstoneRequiredQuests,
  completedQuestCount,
  onAttempt,
}: ChallengeWorkspaceProps) {
  const challenge = quest.challenge;
  const [submission, setSubmission] = useState(() => initialSubmissionFor(challenge));
  const [evaluation, setEvaluation] = useState<ChallengeEvaluation | null>(null);
  const [hintVisible, setHintVisible] = useState(false);
  const hintId = useId();
  const capstoneLocked = quest.isCapstone === true && !capstoneAvailable;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = evaluateChallenge(challenge, submission);
    setEvaluation(result);
    onAttempt({ correct: result.correct, hintUsed: hintVisible });
  }

  function restart() {
    setSubmission(initialSubmissionFor(challenge));
    setEvaluation(null);
    setHintVisible(false);
  }

  return (
    <article className="scq-workspace" aria-labelledby="scq-workspace-title">
      <header className="scq-workspace__header">
        <div>
          <p className="scq-eyebrow">
            Mission {quest.sequence} · {phaseLabel(challenge.phase)}
          </p>
          <h2 id="scq-workspace-title">{quest.title}</h2>
          <p>{quest.briefing}</p>
        </div>
        <p className="scq-status-chip">
          {isComplete ? 'Mission complete' : 'Mission ready'}
        </p>
      </header>

      <section aria-labelledby="scq-objectives-title">
        <h3 id="scq-objectives-title">Mission objectives</h3>
        <ul>
          {quest.objectives.map((objective) => (
            <li key={objective}>{objective}</li>
          ))}
        </ul>
        {prerequisiteTitles.length > 0 ? (
          <p>
            <strong>Recommended preparation:</strong>{' '}
            {prerequisiteTitles.join(', ')}
          </p>
        ) : null}
      </section>

      {capstoneLocked ? (
        <section className="scq-lock-note" aria-labelledby="scq-capstone-lock-title">
          <h3 id="scq-capstone-lock-title">Capstone preview</h3>
          <p>
            Restore at least {capstoneRequiredQuests} regular missions before leading
            this integrated incident. You currently have {completedQuestCount}.
          </p>
        </section>
      ) : (
        <form className="scq-challenge" onSubmit={submit}>
          <h3>{challenge.title}</h3>
          {challenge.context ? (
            <pre className="scq-context" tabIndex={0}>
              <code>{challenge.context}</code>
            </pre>
          ) : null}

          <ChallengeControls
            challenge={challenge}
            submission={submission}
            disabled={evaluation?.correct === true}
            onChange={(nextSubmission) => {
              setSubmission(nextSubmission);
              if (evaluation && !evaluation.correct) setEvaluation(null);
            }}
          />

          <div className="scq-challenge__actions">
            <button
              type="button"
              className="scq-button scq-button--secondary"
              aria-expanded={hintVisible}
              aria-controls={hintId}
              onClick={() => setHintVisible((visible) => !visible)}
            >
              {hintVisible ? 'Hide conceptual hint' : 'Show conceptual hint'}
            </button>
            {evaluation?.correct ? (
              <button
                type="button"
                className="scq-button scq-button--primary"
                onClick={restart}
              >
                Practice this mission again
              </button>
            ) : (
              <button
                type="submit"
                className="scq-button scq-button--primary"
                disabled={!submissionIsReady(challenge, submission)}
              >
                Check my reasoning
              </button>
            )}
          </div>

          <p className="scq-hint" id={hintId} hidden={!hintVisible}>
            <strong>Hint:</strong> {challenge.hint}
          </p>

          <div className="scq-feedback" role="status" aria-live="polite">
            {evaluation ? (
              <>
                <p>
                  <strong>{evaluation.correct ? 'Evidence accepted.' : 'Not yet.'}</strong>{' '}
                  {evaluation.feedback}
                </p>
                {evaluation.correct ? (
                  <p>
                    <strong>Explain before moving on:</strong>{' '}
                    {challenge.reflectionPrompt}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
        </form>
      )}

      <footer className="scq-workspace__footer">
        <details>
          <summary>Lecture provenance</summary>
          <ul>
            {quest.lectureSources.map((source) => (
              <li key={`${source.file}-${source.pages}`}>
                {source.file}, PDF pages {source.pages}
              </li>
            ))}
          </ul>
        </details>
        {quest.deepPracticeUrl ? (
          <a className="scq-button scq-button--secondary" href={quest.deepPracticeUrl}>
            Continue with deep practice
          </a>
        ) : null}
      </footer>
    </article>
  );
}
