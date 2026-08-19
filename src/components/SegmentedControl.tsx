interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Option<T>[];
}

/**
 * A two-or-more way switch with a thumb that slides to the chosen option —
 * a clearer control than a checkbox when both states are named things rather
 * than on and off.
 */
export const SegmentedControl = <T extends string>({ value, onChange, options }: Props<T>) => {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  return (
    <div
      className="segmented"
      role="radiogroup"
      style={{ '--segments': options.length } as React.CSSProperties}
    >
      <span
        className="segmented-thumb"
        aria-hidden
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          className={option.value === value ? 'active' : ''}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
