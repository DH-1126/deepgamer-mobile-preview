import { SELL_SELECTION_STORAGE_KEY } from '../data/recycleFixtures'
import type { SellGameCode, SellSelection } from '../types/sell'

export type SellStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type SellRepositoryOptions = { storage: SellStorage; now?: () => number }

function emptySelection(now: number): SellSelection { return { gameCode: null, recyclerId: null, updatedAt: now } }

function parseSelection(raw: string | null, now: number): SellSelection {
  if (!raw) return emptySelection(now)
  try {
    const value = JSON.parse(raw) as SellSelection
    return typeof value?.updatedAt === 'number' ? value : emptySelection(now)
  } catch { return emptySelection(now) }
}

export function createSellRepository({ storage, now = Date.now }: SellRepositoryOptions) {
  const read = () => parseSelection(storage.getItem(SELL_SELECTION_STORAGE_KEY), now())
  const commit = (selection: SellSelection) => {
    try { storage.setItem(SELL_SELECTION_STORAGE_KEY, JSON.stringify(selection)); return true } catch { return false }
  }
  return {
    getSelection() { return { ...read() } },
    selectGame(gameCode: SellGameCode) { return commit({ gameCode, recyclerId: null, updatedAt: now() }) },
    selectRecycler(recyclerId: string) { const current = read(); if (!current.gameCode) return false; return commit({ ...current, recyclerId, updatedAt: now() }) },
    clear() { try { storage.removeItem(SELL_SELECTION_STORAGE_KEY); return true } catch { return false } },
  }
}

function memoryStorage(): SellStorage {
  const data = new Map<string, string>()
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: (key) => { data.delete(key) } }
}
let storage: SellStorage = memoryStorage()
if (typeof window !== 'undefined') { try { storage = window.localStorage } catch { /* storage unavailable */ } }
export const sellRepository = createSellRepository({ storage })

