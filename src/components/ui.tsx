import { useEffect, useState, type ReactNode } from 'react';
import { parseDecimal } from '../lib/format';
import { StarIcon } from './icons';

export const Field = ({
  label,
  hint,
  /** 'warn' flags a value the model was unsure about, for the user to check. */
  tone,
  children,
}: {
  label: string;
  hint?: string;
  tone?: 'warn';
  children: ReactNode;
}) => (
  <label className={`field${tone === 'warn' ? ' field-warn' : ''}`}>
    <span className="field-label">{label}</span>
    {children}
    {hint ? <span className={`tiny field-hint${tone === 'warn' ? ' warn' : ''}`}>{hint}</span> : null}
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

/**
 * A question that has to be answered before the save goes through, anchored to
 * the bottom of the screen where a thumb already is. Dismissing it — the
 * backdrop or Escape — cancels, so nothing is written by accident.
 */
export const Sheet = ({
  title,
  description,
  onDismiss,
  children,
}: {
  title: string;
  description?: ReactNode;
  onDismiss: () => void;
  children: ReactNode;
}) => (
  <div className="sheet-backdrop" role="presentation" onClick={onDismiss}>
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => event.stopPropagation()}
    >
      <h2 className="sheet-title">{title}</h2>
      {description ? <p className="small sheet-text">{description}</p> : null}
      <div className="stack">{children}</div>
    </div>
  </div>
);

/**
 * A number field that lets you type one.
 *
 * Parsing on every keystroke and rendering the number back erases the decimal
 * point the moment it is typed — "13." parses to 13, which renders as "13" — so
 * the text stays local while the field is being edited, and only the parsed
 * value goes up. A value that arrives from elsewhere (a label scan filling the
 * form) still lands, because it disagrees with what the local text says.
 */
export const NumberInput = ({
  value,
  onChange,
  placeholder,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
  placeholder?: string;
}) => {
  const [text, setText] = useState(value === null ? '' : String(value));

  useEffect(() => {
    if (parseDecimal(text) !== value) setText(value === null ? '' : String(value));
    // Only an outside change is worth following; `text` is this field's own state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(event) => {
        setText(event.target.value);
        onChange(parseDecimal(event.target.value));
      }}
    />
  );
};
