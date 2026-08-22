import { useEffect, useRef, useState } from 'react';
import { getPhoto } from '../lib/db';
import { downscaleImage } from '../lib/image';
import { storedRef, type PhotoRef } from '../lib/photos';
import { BottleIcon, CameraIcon, TrashIcon } from './icons';

/**
 * Resolves a photo reference to an object URL, revoking it on change.
 *
 * The effect is keyed on what the reference points at rather than on the
 * reference object, so a caller may build one inline: keying on the object
 * would re-run this on every render — revoking the URL the image is showing and
 * reading the photo again, forever, since each new URL is a new state value.
 */
export const usePhotoUrl = (ref: PhotoRef): string | null => {
  const [url, setUrl] = useState<string | null>(null);
  const kind = ref?.kind ?? 'none';
  const source = ref === null ? null : ref.kind === 'stored' ? ref.id : ref.blob;

  useEffect(() => {
    let revoked = false;
    let objectUrl: string | null = null;

    const load = async () => {
      const blob = source === null ? null : source instanceof Blob ? source : await getPhoto(source);
      if (revoked) return;
      if (!blob) {
        setUrl(null);
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    };
    void load();

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [kind, source]);

  return url;
};

export const PhotoThumb = ({ photoId }: { photoId: string | null }) => {
  const url = usePhotoUrl(storedRef(photoId));

  return (
    <div className="thumb">
      {url ? <img src={url} alt="" /> : <BottleIcon style={{ width: 22, opacity: 0.35 }} />}
    </div>
  );
};

interface PhotoPickerProps {
  value: PhotoRef;
  onChange: (ref: PhotoRef) => void;
  /** Called with the downscaled blob whenever a new photo is chosen. */
  onCapture?: (blob: Blob) => void;
  label?: string;
}

/** Label photo field: opens the camera on mobile, the file picker on desktop. */
export const PhotoPicker = ({ value, onChange, onCapture, label }: PhotoPickerProps) => {
  const url = usePhotoUrl(value);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const blob = await downscaleImage(file);
    onChange({ kind: 'new', blob });
    onCapture?.(blob);
  };

  return (
    <div>
      {label ? <span className="field-label">{label}</span> : null}
      <div className="photo-frame">
        {url ? (
          <img src={url} alt="Wine label" />
        ) : (
          <div className="center faint small" style={{ padding: 20 }}>
            <CameraIcon style={{ width: 30, marginBottom: 8 }} />
            <div>No label photo yet</div>
          </div>
        )}
        <div className="photo-actions">
          <button type="button" className="btn btn-sm" onClick={() => cameraInput.current?.click()}>
            <CameraIcon />
            {url ? 'Retake' : 'Take photo'}
          </button>
          <button type="button" className="btn btn-sm" onClick={() => fileInput.current?.click()}>
            Choose
          </button>
          {url ? (
            <button type="button" className="btn btn-sm" onClick={() => onChange(null)}>
              <TrashIcon />
            </button>
          ) : null}
        </div>
      </div>
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = '';
        }}
      />
    </div>
  );
};
