import type { ReactNode } from 'react';
import { StarIcon } from './icons';

export const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) => (
  <label className="field">
    <span className="field-label">{label}</span>
    {children}
    {hint ? (
      <span className="tiny faint" style={{ display: 'block', marginTop: 4 }}>
        {hint}
      </span>
    ) : null}
  </label>
);

export const Banner = ({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'error' | 'success';
  children: ReactNode;
}) => <div className={`banner banner-${tone}`}>{children}</div>;

export const EmptyState = ({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
}) => (
  <div className="empty-state">
    {icon}
    <h3>{title}</h3>
    <div className="small">{children}</div>
  </div>
);

export const StarRating = ({
  value,
  onChange,
}: {
  value: number | null;
  onChange?: (next: number | null) => void;
}) => {
  const readonly = !onChange;
  return (
    <div className={`stars${readonly ? ' readonly' : ''}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={value && star <= value ? 'on' : ''}
          disabled={readonly}
          aria-label={`${star} of 5`}
          onClick={() => onChange?.(value === star ? null : star)}
        >
          <StarIcon filled={Boolean(value && star <= value)} />
        </button>
      ))}
    </div>
  );
};

export const Spinner = () => <span className="spinner" aria-hidden />;
