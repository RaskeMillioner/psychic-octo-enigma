import { useState } from 'react';
import { formatDate } from '../lib/format';
import type { CellarReview } from '../lib/enrichment';

interface Props {
  review: CellarReview;
  onClear: () => void;
}

/** The written verdict that came back with the last enrichment import. */
export const CellarReviewCard = ({ review, onClear }: Props) => {
  // Collapsed by default: the statistics are what the tab is for, and the
  // review is there when it is wanted.
  const [open, setOpen] = useState(false);

  return (
    <section className="section">
      <div className="card stack review">
        <div className="row-between">
          <h3 style={{ fontFamily: 'var(--font)', fontSize: 15, fontWeight: 600 }}>
            Cellar review
          </h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(!open)}>
            {open ? 'Hide' : 'Show'}
          </button>
        </div>

        {open ? (
          <>
            {review.summary ? <p className="review-summary">{review.summary}</p> : null}
            {review.strengths.length ? (
              <div>
                <h4 className="section-title" style={{ margin: '4px 0 6px' }}>
                  Strengths
                </h4>
                <ul className="review-list">
                  {review.strengths.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {review.gaps.length ? (
              <div>
                <h4 className="section-title" style={{ margin: '4px 0 6px' }}>
                  Gaps
                </h4>
                <ul className="review-list gaps">
                  {review.gaps.map((point) => (
                    <li key={point}>{point}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {review.suggestions.length ? (
              <div>
                <h4 className="section-title" style={{ margin: '4px 0 6px' }}>
                  Worth looking into
                </h4>
                <ul className="review-list suggestions">
                  {review.suggestions.map((suggestion) => (
                    <li key={suggestion.wine}>
                      <strong>{suggestion.wine}</strong>
                      {suggestion.why ? <span className="muted"> — {suggestion.why}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="row-between" style={{ marginTop: 2 }}>
              <span className="tiny faint">
                {review.savedAt ? `Imported ${formatDate(review.savedAt)}` : 'Imported'}
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
                Clear
              </button>
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
};
