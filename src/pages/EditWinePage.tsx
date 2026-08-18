import { useNavigate, useParams } from 'react-router-dom';
import { CellarWineForm, type CellarFormValues } from '../components/CellarWineForm';
import { Screen } from '../components/Screen';
import { EmptyState } from '../components/ui';
import { BottleIcon } from '../components/icons';
import { putCellarWine } from '../lib/db';
import { commitPhoto, storedRef } from '../lib/photos';
import { useData } from '../lib/store';

export const EditWinePage = () => {
  const { id } = useParams();
  const { wines, loading, reload } = useData();
  const navigate = useNavigate();
  const wine = wines.find((item) => item.id === id);

  if (!wine) {
    return (
      <Screen title="Edit wine" back>
        {loading ? null : <EmptyState icon={<BottleIcon />} title="Wine not found" />}
      </Screen>
    );
  }

  const initial: CellarFormValues = { ...wine };

  return (
    <Screen title="Edit wine" back>
      <CellarWineForm
        initial={initial}
        initialPhoto={storedRef(wine.photoId)}
        submitLabel="Save changes"
        onSubmit={async (values, photo) => {
          const photoId = await commitPhoto(photo, wine.photoId);
          await putCellarWine({ ...wine, ...values, photoId });
          await reload();
          navigate(`/cellar/${wine.id}`, { replace: true });
        }}
      />
    </Screen>
  );
};
