/** Long enough for any browser to have read the blob before it is thrown away. */
const REVOKE_AFTER_MS = 60_000;

/**
 * Hands a JSON file to the browser.
 *
 * The object URL is released on a timer rather than on the next line: revoking
 * it straight after the click can cancel a download that has not started
 * reading yet, which is exactly what a phone browser does with a file it is
 * deciding where to put.
 */
export const downloadJson = (filename: string, data: unknown, indent?: number): void => {
  const blob = new Blob([JSON.stringify(data, null, indent)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
};
