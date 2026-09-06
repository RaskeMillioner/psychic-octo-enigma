/**
 * Thrown when a lazily-loaded part of the app is no longer on the server: the
 * page running in this tab was built before the deploy that replaced it.
 */
export class StaleBuildError extends Error {
  constructor() {
    super(
      'The app was updated while it was open, so this part of it is no longer where the ' +
        'open page expects. Reload to finish updating — anything typed on this screen goes with it.',
    );
    this.name = 'StaleBuildError';
  }
}

export const isStaleBuild = (error: unknown): boolean => error instanceof StaleBuildError;

/**
 * A dynamic `import()` that says why it failed. The scan providers are loaded
 * on demand so neither SDK sits in the first download, and their file names
 * carry a content hash — so an installed app left open across a deploy asks for
 * a file that no longer exists, and the browser reports only "Importing a
 * module script failed", which reads as a broken feature rather than a page
 * that needs reloading.
 *
 * There is no retry here on purpose: a failed module load is remembered, so
 * asking for the same file again returns the same failure without touching the
 * network.
 */
export const loadModule = async <T>(load: () => Promise<T>): Promise<T> => {
  try {
    return await load();
  } catch {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      throw new Error(
        'That part of the app has not been downloaded and you are offline. Scanning needs a ' +
          'connection in any case — try again once you have one.',
      );
    }
    throw new StaleBuildError();
  }
};
