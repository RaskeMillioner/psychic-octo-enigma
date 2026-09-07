import { useMemo } from 'react';
import { companionCompletions, diarySuggestions } from '../lib/diarySuggestions';
import { useData } from '../lib/store';
import type { DiaryEntry } from '../types';
import { SegmentedControl } from './SegmentedControl';
import { Field, NumberInput, StarRating } from './ui';

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

const DataList = ({ id, options }: { id: string; options: string[] }) => (
  <datalist id={id}>
    {options.map((option) => (
      <option key={option} value={option} />
    ))}
  </datalist>
);

interface Props {
  value: DiaryDetails;
  onChange: (patch: Partial<DiaryDetails>) => void;
}

/** The "when, where and how was it" half of a diary entry. */
export const DiaryDetailsFields = ({ value, onChange }: Props) => {
  const { diary } = useData();
  const suggestions = useMemo(() => diarySuggestions(diary), [diary]);
  const companions = useMemo(
    () => companionCompletions(value.companions, suggestions.companions),
    [value.companions, suggestions.companions],
  );

  return (
    <div className="stack">
      <Field label="Date consumed">
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
              list="diary-venues"
              placeholder="Noma"
              onChange={(event) => onChange({ venue: event.target.value })}
            />
          </Field>
          <DataList id="diary-venues" options={suggestions.venues} />
          <div className="grid-2">
            <Field label="City">
              <input
                value={value.city}
                list="diary-cities"
                placeholder="Copenhagen"
                onChange={(event) => onChange({ city: event.target.value })}
              />
            </Field>
            <Field label="Country">
              <input
                value={value.venueCountry}
                list="diary-venue-countries"
                placeholder="Denmark"
                onChange={(event) => onChange({ venueCountry: event.target.value })}
              />
            </Field>
          </div>
          <DataList id="diary-cities" options={suggestions.cities} />
          <DataList id="diary-venue-countries" options={suggestions.venueCountries} />
        </>
      ) : (
        <>
          <Field label="Place">
            <input
              value={value.place}
              list="diary-places"
              placeholder="Home"
              onChange={(event) => onChange({ place: event.target.value })}
            />
          </Field>
          <DataList id="diary-places" options={suggestions.places} />
        </>
      )}

      <div className="grid-2">
        <Field label="Occasion">
          <input
            value={value.occasion}
            list="diary-occasions"
            placeholder="Sunday roast"
            onChange={(event) => onChange({ occasion: event.target.value })}
          />
        </Field>
        <Field label="Shared with">
          <input
            value={value.companions}
            list="diary-companions"
            placeholder="Anna, Peter"
            onChange={(event) => onChange({ companions: event.target.value })}
          />
        </Field>
      </div>
      <DataList id="diary-occasions" options={suggestions.occasions} />
      <DataList id="diary-companions" options={companions} />

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
          <NumberInput value={value.price} placeholder="45" onChange={(price) => onChange({ price })} />
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
};
