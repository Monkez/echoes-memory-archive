import { validateArchive } from "./core.js";
export const STORAGE_KEY = "echoes.archive.v1";
export function readArchive(storage, fallback) {
  const raw = storage.getItem(STORAGE_KEY);
  return raw === null
    ? structuredClone(fallback)
    : validateArchive(JSON.parse(raw));
}
export function writeArchive(storage, archive) {
  const clean = validateArchive(archive);
  storage.setItem(STORAGE_KEY, JSON.stringify(clean));
  return clean;
}
