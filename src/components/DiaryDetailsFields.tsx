import type { DiaryEntry } from '../types';
import { SegmentedControl } from './SegmentedControl';
import { Field, StarRating } from './ui';

export type DiaryDetails = Pick<
  DiaryEntry,
  | 'drunkOn'
  | 'setting'
  | 'place'
  | 'venue'
  | 'city'
  | 'venueCountry'
  | 'occasion'
  | 'companions'
  | 'rating'
  | 'tastingNote'
  | 'price'
  | 'currency'
>;

interface Props {
  value: DiaryDetails;
  onChange: (patch: Partial<DiaryDetails>) => void;
}

/** The "when, where and how was it" half of a diary entry. */
export const DiaryDetailsFields = ({ value, onChange }: Props) => (
  <div className="stack">
    <Field label="Date drunk">
      <input
        type="date"
        value={value.drunkOn}
        onChange={(event) => onChange({ drunkOn: event.target.value })}
      />
    </Field>

    <div>
      <span className="field-label">Where</span>
      <SegmentedControl
        value={value.setting}
        onChange={(setting) => onChange({ setting })}
        options={[
          { value: 'private', label: 'In private' },
          { value: 'venue', label: 'At a venue' },
        ]}
      />
    </div>

    {value.setting === 'venue' ? (
      <>
        <Field label="Restaurant, bar or winery">
          <input
            value={value.venue}
            placeholder="Noma"
            onChange={(event) => onChange({ venue: event.target.value })}
          />
        </Field>
        <div className="grid-2">
          <Field label="City">
            <input
              value={value.city}
              placeholder="Copenhagen"
              onChange={(event) => onChange({ city: event.target.value })}
            />
          </Field>
          <Field label="Country">
            <input
              value={value.venueCountry}
              placeholder="Denmark"
              onChange={(event) => onChange({ venueCountry: event.target.value })}
            />
          </Field>
        </div>
      </>
    ) : (
      <Field label="Place">
        <input
          value={value.place}
          placeholder="Home"
          onChange={(event) => onChange({ place: event.target.value })}
        />
      </Field>
    )}

    <div className="grid-2">
      <Field label="Occasion">
        <input
          value={value.occasion}
          placeholder="Sunday roast"
          onChange={(event) => onChange({ occasion: event.target.value })}
        />
      </Field>
      <Field label="Shared with">
        <input
          value={value.companions}
          placeholder="Anna, Peter"
          onChange={(event) => onChange({ companions: event.target.value })}
        />
      </Field>
    </div>

    <div>
      <span className="field-label">Rating</span>
      <StarRating value={value.rating} onChange={(rating) => onChange({ rating })} />
    </div>

    <Field label="Tasting note">
      <textarea
        value={value.tastingNote}
        placeholder="How did it show? Nose, palate, how it developed in the glass…"
        onChange={(event) => onChange({ tastingNote: event.target.value })}
      />
    </Field>

    <div className="grid-2">
      <Field label="Price per bottle">
        <input
          inputMode="decimal"
          value={value.price ?? ''}
          placeholder="45"
          onChange={(event) => {
            const parsed = Number.parseFloat(event.target.value.replace(',', '.'));
            onChange({ price: Number.isFinite(parsed) ? parsed : null });
          }}
        />
      </Field>
      <Field label="Currency">
        <input
          value={value.currency}
          maxLength={3}
          onChange={(event) => onChange({ currency: event.target.value.toUpperCase() })}
        />
      </Field>
    </div>
  </div>
);
