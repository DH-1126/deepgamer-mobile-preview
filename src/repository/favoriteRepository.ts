import { createDefaultFavoriteRecords, FAVORITES_STORAGE_KEY, LEGACY_FAVORITE_PREFIX } from '../data/favoriteFixtures'
import type { FavoriteRecord, FavoriteStatus } from '../types/favorite'

export type FavoriteStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>
type Listener = () => void

type RepositoryOptions = {
  storage: FavoriteStorage
  now?: () => number
  eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>
}

const FAVORITES_EVENT = 'deepgamer:favorites-change'

function parseRecords(raw: string | null): FavoriteRecord[] | null {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value.filter((item): item is FavoriteRecord => Boolean(
      item && typeof item === 'object'
      && typeof (item as FavoriteRecord).productId === 'string'
      && Number.isFinite((item as FavoriteRecord).favoritedAt),
    )).map((item) => ({
      productId: item.productId,
      favoritedAt: item.favoritedAt,
      ...(item.statusSnapshot ? { statusSnapshot: item.statusSnapshot } : {}),
    }))
  } catch { return [] }
}

export function createFavoriteRepository({ storage, now = Date.now, eventTarget }: RepositoryOptions) {
  const listeners = new Set<Listener>()
  const source = `favorites-${Math.random().toString(36).slice(2)}`

  const notify = () => listeners.forEach((listener) => listener())
  const announce = () => {
    notify()
    if (eventTarget && typeof CustomEvent !== 'undefined') eventTarget.dispatchEvent(new CustomEvent(FAVORITES_EVENT, { detail: { source } }))
  }

  const hydrate = (): FavoriteRecord[] => {
    const current = parseRecords(storage.getItem(FAVORITES_STORAGE_KEY))
    if (current !== null) return current

    const migrated: FavoriteRecord[] = []
    let foundLegacy = false
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (!key?.startsWith(LEGACY_FAVORITE_PREFIX)) continue
      foundLegacy = true
      if (storage.getItem(key) === 'true') migrated.push({ productId: key.slice(LEGACY_FAVORITE_PREFIX.length), favoritedAt: now(), statusSnapshot: 'on_sale' })
    }
    const initial = foundLegacy ? migrated : createDefaultFavoriteRecords(now())
    storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(initial))
    return initial
  }

  const commit = (next: FavoriteRecord[], legacyIds: string[]) => {
    const previousRaw = storage.getItem(FAVORITES_STORAGE_KEY)
    const previousLegacy = new Map(legacyIds.map((id) => [id, storage.getItem(`${LEGACY_FAVORITE_PREFIX}${id}`)]))
    try {
      storage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next))
      legacyIds.forEach((id) => storage.setItem(`${LEGACY_FAVORITE_PREFIX}${id}`, String(next.some((record) => record.productId === id))))
      announce()
      return true
    } catch {
      try {
        if (previousRaw === null) storage.removeItem(FAVORITES_STORAGE_KEY)
        else storage.setItem(FAVORITES_STORAGE_KEY, previousRaw)
        previousLegacy.forEach((value, id) => value === null ? storage.removeItem(`${LEGACY_FAVORITE_PREFIX}${id}`) : storage.setItem(`${LEGACY_FAVORITE_PREFIX}${id}`, value))
      } catch { /* Best-effort rollback for unavailable storage. */ }
      return false
    }
  }

  const onExternalChange = (event: Event) => {
    if (event instanceof CustomEvent && event.detail?.source === source) return
    if (typeof StorageEvent !== 'undefined' && event instanceof StorageEvent && event.key && event.key !== FAVORITES_STORAGE_KEY && !event.key.startsWith(LEGACY_FAVORITE_PREFIX)) return
    notify()
  }
  eventTarget?.addEventListener(FAVORITES_EVENT, onExternalChange)
  eventTarget?.addEventListener('storage', onExternalChange)

  return {
    list: () => hydrate().map((record) => ({ ...record })),
    isFavorite: (productId: string) => hydrate().some((record) => record.productId === productId),
    add(productId: string, statusSnapshot: FavoriteStatus = 'on_sale', favoritedAt = now()) {
      try {
        const current = hydrate()
        if (current.some((record) => record.productId === productId)) return true
        return commit([...current, { productId, favoritedAt, statusSnapshot }], [productId])
      } catch { return false }
    },
    remove(productId: string) {
      try {
        const current = hydrate()
        if (!current.some((record) => record.productId === productId)) return true
        return commit(current.filter((record) => record.productId !== productId), [productId])
      } catch { return false }
    },
    removeMany(productIds: string[]) {
      try {
        const ids = [...new Set(productIds)]
        const current = hydrate()
        return commit(current.filter((record) => !ids.includes(record.productId)), ids)
      } catch { return false }
    },
    restore(records: FavoriteRecord[]) {
      try {
        const currentIds = hydrate().map((record) => record.productId)
        return commit(records.map((record) => ({ ...record })), [...new Set([...currentIds, ...records.map((record) => record.productId)])])
      } catch { return false }
    },
    subscribe(listener: Listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    dispose() {
      eventTarget?.removeEventListener(FAVORITES_EVENT, onExternalChange)
      eventTarget?.removeEventListener('storage', onExternalChange)
      listeners.clear()
    },
  }
}

function createMemoryStorage(): FavoriteStorage {
  const values = new Map<string, string>()
  return {
    get length() { return values.size },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
  }
}

let storage: FavoriteStorage = createMemoryStorage()
let target: RepositoryOptions['eventTarget']
if (typeof window !== 'undefined') {
  try { storage = window.localStorage; target = window } catch { /* Private mode can deny storage access. */ }
}

export const favoriteRepository = createFavoriteRepository({ storage, eventTarget: target })
