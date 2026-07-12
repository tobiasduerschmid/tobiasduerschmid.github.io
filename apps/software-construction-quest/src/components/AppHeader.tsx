interface AppHeaderProps {
  readonly completedQuests: number;
  readonly totalQuests: number;
  readonly dueReviews: number;
  readonly onReviewDue: () => void;
  readonly onRequestReset: () => void;
}

export function AppHeader({
  completedQuests,
  totalQuests,
  dueReviews,
  onReviewDue,
  onRequestReset,
}: AppHeaderProps) {
  return (
    <header className="scq-header">
      <div className="scq-header__copy">
        <p className="scq-eyebrow">A Software Construction Quest</p>
        <h1 id="scq-title">The Broken Build</h1>
        <p>
          Restore a campus software network by predicting, repairing, explaining,
          and transferring the skills from Software Construction.
        </p>
      </div>
      <nav className="scq-header__links" aria-label="Quest resources">
        <a href="/SEBook/">Open SEBook</a>
        <a href="/se-gym/#hero-customizer-section">Customize hero</a>
        <a href="/cookies/">Stored progress</a>
      </nav>
      <div className="scq-progress-summary">
        <label htmlFor="scq-course-progress">Systems restored</label>
        <progress
          id="scq-course-progress"
          max={totalQuests}
          value={completedQuests}
        >
          {completedQuests} of {totalQuests}
        </progress>
        <p>
          <strong>{completedQuests}</strong> of {totalQuests} missions complete
        </p>
        <div className="scq-inline-actions">
          <button
            type="button"
            className="scq-button scq-button--secondary"
            onClick={onReviewDue}
            disabled={dueReviews === 0}
          >
            Review due missions ({dueReviews})
          </button>
          <button
            type="button"
            className="scq-button scq-button--quiet"
            onClick={onRequestReset}
          >
            Reset quest progress
          </button>
        </div>
      </div>
    </header>
  );
}
