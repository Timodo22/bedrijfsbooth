import {convertStringToUrl, retryImport} from './utils';

interface RetryConfig {
  maxRetries?: number;
  retryDelay?: number;
  signal?: AbortSignal;
}

// Pseudo code for the importWithRetry function:
// 1. Try the normal relative dynamic import
// 2. If it fails, the error that we will get had the message "Failed to fetch dynamically imported module: <http full path>"
// 3. We then parse the http full path of the asset and add a timestamp query param
// 4. We retry the import of the absolute http path with the timestamp, this forces the browser to do a new request to fetch the source. Otherwise, it catches the source and does try a new fetch.
// 5. Repeat steps 2 to 4 until we reach the maxRetries
//
// Mermaid diagram for the pseudo code in ./docs.md
export async function importWithRetry<T>(
  initialDynamicImport: () => Promise<T>,
  {maxRetries = 3, retryDelay = 1000, signal}: RetryConfig = {},
): Promise<T | undefined> {
  const executeWithRetry = async ({
    retryCount = 0,
    importPromise,
    retryImportPath,
  }: {
    retryCount?: number;
    importPromise?: () => Promise<T>;
    retryImportPath?: string;
  }): Promise<T | undefined> => {
    if (signal?.aborted) return undefined;

    try {
      if (importPromise) {
        return await importPromise();
      }

      return await retryImport(retryImportPath || '');
    } catch (error) {
      if (!(error instanceof Error) || signal?.aborted) {
        return undefined;
      }

      const url = convertStringToUrl(
        error.message
          .replace('Failed to fetch dynamically imported module: ', '')
          .trim(),
      );

      if (!url) {
        throw error;
      }

      url.searchParams.set('t', `${Number(new Date())}`);

      if (retryCount < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        if (signal?.aborted) return undefined;
        return executeWithRetry({
          retryCount: retryCount + 1,
          retryImportPath: url.href,
        });
        return;
      }
      throw error;
    }
  };

  return executeWithRetry({
    importPromise: initialDynamicImport,
  });
}
