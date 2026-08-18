import { useMemo } from 'react';
import { parseGrapes } from '../lib/format';
import { useData } from '../lib/store';
import { BOTTLE_SIZES, WINE_TYPES, type WineFacts } from '../types';
import { Field } from './ui';

/** Values already used in the cellar or diary, offered as autocomplete. */
const useSuggestions = () => {
  const { wines, diary } = useData();
  return useMemo(() => {
    const all = [...wines, ...diary];
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort();
    return {
      producers: unique(all.map((item) => item.producer)),
      countries: unique(all.map((item) => item.country)),
      regions: unique(all.map((item) => item.region)),
      appellations: unique(all.map((item) => item.appellation)),
      classifications: unique(all.map((item) => item.classification)),
      grapes: unique(all.flatMap((item) => item.grapes)),
    };
  }, [wines, diary]);
};

const DataList = ({ id, options }: { id: string; options: string[] }) => (
  <datalist id={id}>
    {options.map((option) => (
      <option key={option} value={option} />
    ))}
  </datalist>
);

interface Props {
  value: WineFacts;
  onChange: (patch: Partial<WineFacts>) => void;
}

export const WineFactsFields = ({ value, onChange }: Props) => {
  const suggestions = useSuggestions();

  return (
    <div className="stack">
      <Field label="Producer">
        <input
          list="producers"
          value={value.producer}
          placeholder="Domaine Leflaive"
          onChange={(event) => onChange({ producer: event.target.value })}
        />
      </Field>
      <DataList id="producers" options={suggestions.producers} />

      <Field label="Cuvée / wine name">
        <input
          value={value.name}
          placeholder="Clavoillon"
          onChange={(event) => onChange({ name: event.target.value })}
        />
      </Field>

      <div className="grid-2">
        <Field label="Vintage" hint="Leave empty for NV">
          <input
            inputMode="numeric"
            maxLength={4}
            value={value.vintage ?? ''}
            placeholder="2019"
            onChange={(event) => {
              const digits = event.target.value.replace(/\D/g, '').slice(0, 4);
              onChange({ vintage: digits ? Number(digits) : null });
            }}
          />
        </Field>
        <Field label="Type">
          <select
            value={value.wineType}
            onChange={(event) => onChange({ wineType: event.target.value as WineFacts['wineType'] })}
          >
            <option value="">Unspecified</option>
            {WINE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid-2">
        <Field label="Country">
          <input
            list="countries"
            value={value.country}
            placeholder="France"
            onChange={(event) => onChange({ country: event.target.value })}
          />
        </Field>
        <Field label="Region">
          <input
            list="regions"
            value={value.region}
            placeholder="Burgundy"
            onChange={(event) => onChange({ region: event.target.value })}
          />
        </Field>
      </div>
      <DataList id="countries" options={suggestions.countries} />
      <DataList id="regions" options={suggestions.regions} />

      <Field label="Appellation">
        <input
          list="appellations"
          value={value.appellation}
          placeholder="Puligny-Montrachet 1er Cru"
          onChange={(event) => onChange({ appellation: event.target.value })}
        />
      </Field>
      <DataList id="appellations" options={suggestions.appellations} />

      <Field label="Classification">
        <input
          list="classifications"
          value={value.classification}
          placeholder="Premier Cru"
          onChange={(event) => onChange({ classification: event.target.value })}
        />
      </Field>
      <DataList id="classifications" options={suggestions.classifications} />

      <Field label="Grape varieties" hint="Separate with commas">
        <input
          value={value.grapes.join(', ')}
          placeholder="Chardonnay"
          onChange={(event) => onChange({ grapes: parseGrapes(event.target.value) })}
        />
      </Field>

      <div className="grid-2">
        <Field label="Bottle size">
          <select
            value={value.sizeMl}
            onChange={(event) => onChange({ sizeMl: Number(event.target.value) })}
          >
            {BOTTLE_SIZES.map((size) => (
              <option key={size.ml} value={size.ml}>
                {size.label}
              </option>
            ))}
            {BOTTLE_SIZES.every((size) => size.ml !== value.sizeMl) ? (
              <option value={value.sizeMl}>{value.sizeMl} ml</option>
            ) : null}
          </select>
        </Field>
        <Field label="Alcohol %">
          <input
            inputMode="decimal"
            value={value.abv ?? ''}
            placeholder="13.5"
            onChange={(event) => {
              const parsed = Number.parseFloat(event.target.value.replace(',', '.'));
              onChange({ abv: Number.isFinite(parsed) ? parsed : null });
            }}
          />
        </Field>
      </div>
    </div>
  );
};
