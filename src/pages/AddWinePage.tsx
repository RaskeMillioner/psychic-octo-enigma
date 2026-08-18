import { useNavigate } from 'react-router-dom';
import { blankCellarValues, CellarWineForm } from '../components/CellarWineForm';
import { Screen } from '../components/Screen';
import { createCellarWine } from '../lib/db';
import { commitPhoto } from '../lib/photos';
import { useData } from '../lib/store';

export const AddWinePage = () => {
  const { settings, reload } = useData();
  const navigate = useNavigate();

  return (
    <Screen title="Add wine" back>
      <CellarWineForm
        initial={blankCellarValues(settings.currency)}
        initialPhoto={null}
        submitLabel="Add to cellar"
        onSubmit={async (values, photo) => {
          const photoId = await commitPhoto(photo, null);
          const wine = await createCellarWine({ ...values, photoId });
          await reload();
          navigate(`/cellar/${wine.id}`, { replace: true });
        }}
      />
    </Screen>
  );
};
