import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PhotoThumb } from './Photo';

interface Props {
  to: string;
  photoId: string | null;
  producer: string;
  title: string;
  meta: string;
  right?: ReactNode;
}

export const WineCard = ({ to, photoId, producer, title, meta, right }: Props) => (
  <Link to={to} className="wine-card">
    <PhotoThumb photoId={photoId} />
    <div className="body">
      {producer ? <div className="producer">{producer}</div> : null}
      <div className="title">{title}</div>
      {meta ? <div className="meta">{meta}</div> : null}
    </div>
    {right}
  </Link>
);
