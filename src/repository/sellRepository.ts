import { SELL_SELECTION_STORAGE_KEY } from '../data/recycleFixtures'
import type { GameAccessRequest, GameAccessRequestInput, SellGameCode, SellSelection } from '../types/sell'
import { validateGameAccessRequest } from '../components/sellModel'
import { getRuntimeStorage } from '../runtime/dataMode'

export type SellStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type SellRepositoryOptions = { storage: SellStorage; now?: () => number }
export const GAME_ACCESS_REQUESTS_KEY = 'deepgamer.sell.game-requests.v1'

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
  const readGameRequests = (): GameAccessRequest[] => {
    const raw = storage.getItem(GAME_ACCESS_REQUESTS_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.some(item => !item || typeof item.gameName !== 'string' || typeof item.manufacturer !== 'string' || !Number.isFinite(item.createdAt))) throw new Error('Invalid game request data')
    return parsed.map(item => ({ gameName: item.gameName, manufacturer: item.manufacturer, createdAt: item.createdAt }))
  }
  const commit = (selection: SellSelection) => {
    try { storage.setItem(SELL_SELECTION_STORAGE_KEY, JSON.stringify(selection)); return true } catch { return false }
  }
  return {
    getSelection() { return { ...read() } },
    getGameRequests() { return readGameRequests() },
    /** Local prototype only: no external submission or automatic game activation. */
    requestGame(input: GameAccessRequestInput) {
      if (Object.keys(validateGameAccessRequest(input)).length) return false
      const request = { gameName: input.gameName.trim(), manufacturer: input.manufacturer.trim() }
      try {
        const current = readGameRequests()
        if (current.some(item => item.gameName === request.gameName && item.manufacturer === request.manufacturer)) return true
        storage.setItem(GAME_ACCESS_REQUESTS_KEY, JSON.stringify([...current, { ...request, createdAt: now() }]))
        return true
      } catch { return false }
    },
    selectGame(gameCode: SellGameCode) { return commit({ gameCode, recyclerId: null, updatedAt: now() }) },
    selectRecycler(recyclerId: string) { const current = read(); if (!current.gameCode) return false; return commit({ ...current, recyclerId, updatedAt: now() }) },
    clear() { try { storage.removeItem(SELL_SELECTION_STORAGE_KEY); return true } catch { return false } },
  }
}

function memoryStorage(): SellStorage {
  const data = new Map<string, string>()
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) }, removeItem: (key) => { data.delete(key) } }
}
const storage: SellStorage = getRuntimeStorage()
export const sellRepository = createSellRepository({ storage })
