import {
  emptySellerApplication,
  type SellerApplicationSnapshot,
  type SellerApplicationStatus,
  type SellerEntityType,
  type SellerSubject,
} from '../components/sellerContractModel'
import { getRuntimeStorage } from '../runtime/dataMode'

export const SELLER_APPLICATION_STORAGE_KEY = 'deepgamer.seller-application.v2'
export const LEGACY_SELLER_APPLICATION_STORAGE_KEY = 'deepgamer.seller-application.v1'

export type SellerApplicationStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const statuses = new Set<SellerApplicationStatus>(['not_started', 'under_review', 'changes_requested', 'approved', 'active'])
const subjects = new Set<SellerSubject>(['personal', 'business'])
const entityTypes = new Set<SellerEntityType>(['individual', 'company'])

function sanitize(value: unknown): SellerApplicationSnapshot {
  if (!value || typeof value !== 'object') return emptySellerApplication
  const raw = value as Record<string, unknown>
  if (!statuses.has(raw.status as SellerApplicationStatus)) return emptySellerApplication
  if (raw.status === 'not_started') return emptySellerApplication
  if (!subjects.has(raw.subject as SellerSubject)) return emptySellerApplication
  const snapshot: SellerApplicationSnapshot = { status: raw.status as SellerApplicationStatus, subject: raw.subject as SellerSubject }
  if (snapshot.subject === 'business' && entityTypes.has(raw.entityType as SellerEntityType)) snapshot.entityType = raw.entityType as SellerEntityType
  if (typeof raw.takeoutOrderMediaId === 'string' && raw.takeoutOrderMediaId.length <= 160) snapshot.takeoutOrderMediaId = raw.takeoutOrderMediaId
  if (typeof raw.submittedAt === 'number' && Number.isFinite(raw.submittedAt)) snapshot.submittedAt = raw.submittedAt
  return snapshot
}

export function createSellerApplicationRepository(storage: SellerApplicationStorage) {
  return {
    getSnapshot(): SellerApplicationSnapshot {
      try {
        const raw = storage.getItem(SELLER_APPLICATION_STORAGE_KEY) ?? storage.getItem(LEGACY_SELLER_APPLICATION_STORAGE_KEY)
        return raw ? sanitize(JSON.parse(raw)) : emptySellerApplication
      } catch { return emptySellerApplication }
    },
    save(snapshot: SellerApplicationSnapshot) {
      try { storage.setItem(SELLER_APPLICATION_STORAGE_KEY, JSON.stringify(sanitize(snapshot))); return true } catch { return false }
    },
    clear() {
      try { storage.removeItem(SELLER_APPLICATION_STORAGE_KEY); storage.removeItem(LEGACY_SELLER_APPLICATION_STORAGE_KEY); return true } catch { return false }
    },
  }
}

function memoryStorage(): SellerApplicationStorage {
  const values = new Map<string, string>()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: (key) => { values.delete(key) } }
}

const storage: SellerApplicationStorage = getRuntimeStorage()
export const sellerApplicationRepository = createSellerApplicationRepository(storage)
