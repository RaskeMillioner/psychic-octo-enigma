import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeftIcon } from './icons';

interface Props {
  title: string;
  /** Shows a back chevron in the header. */
  back?: boolean;
  /** Rendered at the right edge of the header. */
  action?: ReactNode;
  /**
   * The floating action button, if the page has one. It belongs to the app
   * frame rather than to the scrolling content, so it keeps its place above the
   * navigation bar instead of scrolling away with the list.
   */
  fab?: ReactNode;
  children: ReactNode;
}

export const Screen = ({ title, back, action, fab, children }: Props) => {
  const navigate = useNavigate();
  return (
    <>
      <header className="app-header">
        {back ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: -10 }}
            aria-label="Back"
            onClick={() => navigate(-1)}
          >
            <ChevronLeftIcon />
          </button>
        ) : null}
        <h1>{title}</h1>
        {action}
      </header>
      <main className="app-main">{children}</main>
      {fab}
    </>
  );
};
