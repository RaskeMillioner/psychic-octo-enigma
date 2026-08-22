/**
 * Whether a photo is still pointed at by something.
 *
 * A receipt scan deliberately gives every bottle from one delivery the same
 * photo, so deleting a record — or replacing its photo — must not take the blob
 * with it while another record still shows it.
 */
type PhotoHolder = { id: string; photoId: string | null };

export const photoInUse = (
  photoId: string,
  holders: PhotoHolder[][],
  /** The record being deleted or rewritten, which no longer counts as a holder. */
  exceptId?: string,
): boolean =>
  holders.some((group) =>
    group.some((holder) => holder.photoId === photoId && holder.id !== exceptId),
  );
