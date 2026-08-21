import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  blankCellarValues,
  CellarWineForm,
  SubmitCancelled,
  type CellarFormValues,
} from '../components/CellarWineForm';
import { Screen } from '../components/Screen';
import { Sheet } from '../components/ui';
import { createCellarWine, putCellarWine } from '../lib/db';
import { findDuplicate, mergeIntoCellar } from '../lib/duplicates';
import { bottleCount, wineTitle } from '../lib/format';
import { commitPhoto } from '../lib/photos';
import { useData } from '../lib/store';
import type { CellarWine } from '../types';

type Choice = 'merge' | 'separate';

export const AddWinePage = () => {
  const { settings, wines, reload } = useData();
  const navigate = useNavigate();
  /** The entry the new bottles look like, while the user decides what to do. */
  const [match, setMatch] = useState<CellarWine | null>(null);
  const answer = useRef<((choice: Choice | null) => void) | null>(null);

  const decide = (existing: CellarWine): Promise<Choice | null> => {
    setMatch(existing);
    return new Promise((resolve) => {
      answer.current = resolve;
    });
  };

  const settle = (choice: Choice | null) => {
    setMatch(null);
    answer.current?.(choice);
    answer.current = null;
  };

  const save = async (values: CellarFormValues, photoId: string | null) => {
    const existing = findDuplicate(values, wines);
    const draft = { ...values, photoId };

    // No match, or the user wants this delivery on its own line.
    let target: CellarWine;
    if (!existing) {
      target = await createCellarWine(draft);
    } else {
      const choice = await decide(existing);
      if (choice === null) throw new SubmitCancelled();
      target =
        choice === 'merge'
          ? await putCellarWine(mergeIntoCellar(existing, draft))
          : await createCellarWine(draft);
    }
    await reload();
    navigate(`/cellar/${target.id}`, { replace: true });
  };

  return (
    <Screen title="Add wine" back>
      <CellarWineForm
        initial={blankCellarValues(settings.currency)}
        initialPhoto={null}
        submitLabel="Add to cellar"
        onSubmit={async (values, photo) => {
          await save(values, await commitPhoto(photo, null));
        }}
      />

      {match ? (
        <Sheet
          title="Already in your cellar"
          description={
            <>
              You already hold {bottleCount(match.quantity)} of {wineTitle(match)}. Add these to
              that entry, or keep them apart?
            </>
          }
          onDismiss={() => settle(null)}
        >
          <button type="button" className="btn btn-primary btn-block" onClick={() => settle('merge')}>
            Add to the existing entry
          </button>
          <button type="button" className="btn btn-block" onClick={() => settle('separate')}>
            Keep a separate line
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => settle(null)}>
            Cancel
          </button>
        </Sheet>
      ) : null}
    </Screen>
  );
};
