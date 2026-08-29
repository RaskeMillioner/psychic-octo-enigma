import { useMemo, useState } from 'react';
import {
  describeVenuePatch,
  rememberedCities,
  rememberedCompanions,
  rememberedPlaces,
  rememberedVenueCountries,
  rememberedVenues,
  suggestCompanions,
  venueLocation,
  venuePatch,
} from '../lib/diaryMemory';
import { useData } from '../lib/store';
import type { DiaryEntry } from '../types';
import { SegmentedControl } from './SegmentedControl';
import { DataList, Field, NumberInput, StarRating } from './ui';

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

/** Where and with whom you have drunk before, offered back as autocomplete. */
const useMemory = () => {
  const { diary } = useData();
  return useMemo(
    () => ({
      diary,
      places: rememberedPlaces(diary),
      venues: rememberedVenues(diary),
      cities: rememberedCities(diary),
      countries: rememberedVenueCountries(diary),
      companions: rememberedCompanions(diary),
    }),
    [diary],
  );
};

/** The "when, where and how was it" half of a diary entry. */
export const DiaryDetailsFields = ({ value, onChange }: Props) => {
  const memory = useMemory();
  const [venueHint, setVenueHint] = useState('');

  const companionOptions = useMemo(
    () => suggestCompanions(value.companions, memory.companions),
    [value.companions, memory.companions],
  );

  /**
   * A venue you have been to before knows where it is, so recognising it fills
   * the blanks around it — never overwriting anything already entered.
   */
  const handleVenue = (input: string) => {
    const known = venueLocation(memory.diary, input);
    if (!known) {
      onChange({ venue: input });
      setVenueHint('');
      return;
    }
    const patch = venuePatch(value, known);
    onChange({ venue: input, ...patch });
    setVenueHint(describeVenuePatch(patch));
  };

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
          <Field label="Restaurant, bar or winery" hint={venueHint}>
            <input
              list="diary-venues"
              value={value.venue}
              placeholder="Noma"
              onChange={(event) => handleVenue(event.target.value)}
            />
          </Field>
          <DataList id="diary-venues" options={memory.venues} />
          <div className="grid-2">
            <Field label="City">
              <input
                list="diary-cities"
                value={value.city}
                placeholder="Copenhagen"
                onChange={(event) => onChange({ city: event.target.value })}
              />
            </Field>
            <Field label="Country">
              <input
                list="diary-countries"
                value={value.venueCountry}
                placeholder="Denmark"
                onChange={(event) => onChange({ venueCountry: event.target.value })}
              />
            </Field>
          </div>
          <DataList id="diary-cities" options={memory.cities} />
          <DataList id="diary-countries" options={memory.countries} />
        </>
      ) : (
        <>
          <Field label="Place">
            <input
              list="diary-places"
              value={value.place}
              placeholder="Home"
              onChange={(event) => onChange({ place: event.target.value })}
            />
          </Field>
          <DataList id="diary-places" options={memory.places} />
        </>
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
            list="diary-companions"
            value={value.companions}
            placeholder="Anna, Peter"
            onChange={(event) => onChange({ companions: event.target.value })}
          />
        </Field>
      </div>
      <DataList id="diary-companions" options={companionOptions} />

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
          <NumberInput
            value={value.price}
            placeholder="45"
            onChange={(price) => onChange({ price })}
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
};
