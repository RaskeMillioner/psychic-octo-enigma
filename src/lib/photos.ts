import { getPhoto, releasePhoto, savePhoto } from './db';

/** A photo that is either already in the database or freshly captured. */
export type PhotoRef =
  | { kind: 'stored'; id: string }
  | { kind: 'new'; blob: Blob }
  | null;

export const storedRef = (id: string | null): PhotoRef => (id ? { kind: 'stored', id } : null);

/**
 * Persists a form's photo choice and returns the id to store on the record,
 * cleaning up the previous photo when it was replaced or removed.
 *
 * `ownerId` is the record being saved: it still points at `previousId` in the
 * database at this moment, so it does not count as a reason to keep that photo —
 * but another record sharing it does.
 */
export const commitPhoto = async (
  ref: PhotoRef,
  previousId: string | null,
  ownerId?: string,
): Promise<string | null> => {
  if (ref?.kind === 'stored') return ref.id;
  if (ref?.kind === 'new') {
    const id = await savePhoto(ref.blob);
    if (previousId) await releasePhoto(previousId, ownerId);
    return id;
  }
  if (previousId) await releasePhoto(previousId, ownerId);
  return null;
};

export const resolvePhotoBlob = async (ref: PhotoRef): Promise<Blob | null> => {
  if (!ref) return null;
  return ref.kind === 'new' ? ref.blob : getPhoto(ref.id);
};
