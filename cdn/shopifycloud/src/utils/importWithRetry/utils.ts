import {isoWindow} from '../window';

export const retryImport = (path: string) => {
  return import(path);
};

export const convertStringToUrl = (url: string) => {
  try {
    return new isoWindow.URL(url);
  } catch {
    return null;
  }
};
