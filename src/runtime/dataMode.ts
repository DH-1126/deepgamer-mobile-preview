export const isLinkedDataMode = import.meta.env.VITE_DATA_MODE === 'linked'

const values = new Map<string, string>()

/** Shared for this document only: SPA navigation keeps state; a reload starts fresh. */
export const volatileStorage: Storage = {
  get length() { return values.size },
  clear() { values.clear() },
  getItem(key) { return values.get(key) ?? null },
  key(index) { return [...values.keys()][index] ?? null },
  removeItem(key) { values.delete(key) },
  setItem(key, value) { values.set(key, String(value)) },
}

export function getRuntimeStorage(): Storage {
  // Prototype sessions always behave like a fresh install after a reload.
  // Ignore existing browser persistence without deleting it or changing linked backend data.
  return volatileStorage
}
