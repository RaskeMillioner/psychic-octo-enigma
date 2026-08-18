import { deletePhoto, getPhoto, savePhoto } from './db';

/** A photo that is either already in the database or freshly captured. */
export type PhotoRef =
  | { kind: 'stored'; id: string }
  | { kind: 'new'; blob: Blob }
  | null;

export const storedRef = (id: string | null): PhotoRef => (id ? { kind: 'stored', id } : null);

/**
 * Persists a form's photo choice and returns the id to store on the record,
 * cleaning up the previous photo when it was replaced or removed.
 */
export const commitPhoto = async (ref: PhotoRef, previousId: string | null): Promise<string | null> => {
  if (ref?.kind === 'stored') return ref.id;
  if (ref?.kind === 'new') {
    const id = await savePhoto(ref.blob);
    if (previousId) await deletePhoto(previousId);
    return id;
  }
  if (previousId) await deletePhoto(previousId);
  return null;
};

export const resolvePhotoBlob = async (ref: PhotoRef): Promise<Blob | null> => {
  if (!ref) return null;
  return ref.kind === 'new' ? ref.blob : getPhoto(ref.id);
};
