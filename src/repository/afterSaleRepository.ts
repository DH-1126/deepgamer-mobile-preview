import { afterSalesFixtures, AFTERSALES_STORAGE_KEY } from '../data/afterSalesFixtures'
import type { AfterSaleApplicationInput, AfterSaleRecord, AfterSaleStatus } from '../types/aftersale'
import type { OrderRecord } from '../types/order'
import { getRuntimeStorage, isLinkedDataMode } from '../runtime/dataMode'

export type AfterSaleStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Options = {
  storage: AfterSaleStorage
  now?: () => number
  eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'>
}

const EVENT = 'deepgamer:aftersales-change'
const ACTIVE: readonly AfterSaleStatus[] = ['pending_review', 'supplement', 'platform_processing', 'refunding']

function isRecord(value: unknown): value is AfterSaleRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as AfterSaleRecord
  return typeof record.id === 'string' && typeof record.orderId === 'string' && typeof record.productId === 'string'
    && ['pending_review', 'supplement', 'refunding', 'platform_processing', 'rejected', 'completed', 'withdrawn'].includes(record.status)
    && Number.isInteger(record.refundAmountCents) && typeof record.createdAt === 'string' && typeof record.updatedAt === 'string'
}

function clone(record: AfterSaleRecord): AfterSaleRecord {
  return {
    ...record,
    materialNames: record.materialNames ? [...record.materialNames] : undefined,
    supplements: record.supplements?.map((item) => ({ ...item, materialNames: [...item.materialNames] })),
  }
}

function parse(raw: string | null) {
  if (raw === null) return null
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? value.filter(isRecord) : []
  } catch { return [] }
}

function formatDate(value: number) {
  const date = new Date(value)
  const two = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())} ${two(date.getHours())}:${two(date.getMinutes())}`
}

export function createAfterSaleRepository({ storage, now = Date.now, eventTarget }: Options) {
  const listeners = new Set<() => void>()
  const source = `aftersales-${Math.random().toString(36).slice(2)}`
  const read = () => {
    const persisted = parse(storage.getItem(AFTERSALES_STORAGE_KEY))
    if (persisted !== null) return persisted
    const seed = afterSalesFixtures.map(clone)
    storage.setItem(AFTERSALES_STORAGE_KEY, JSON.stringify(seed))
    return seed
  }
  const emit = () => {
    listeners.forEach((listener) => listener())
    if (eventTarget && typeof CustomEvent !== 'undefined') eventTarget.dispatchEvent(new CustomEvent(EVENT, { detail: { source } }))
  }
  const commit = (records: readonly AfterSaleRecord[]) => {
    const previous = storage.getItem(AFTERSALES_STORAGE_KEY)
    try {
      storage.setItem(AFTERSALES_STORAGE_KEY, JSON.stringify(records))
      emit()
      return true
    } catch {
      try { previous === null ? storage.removeItem(AFTERSALES_STORAGE_KEY) : storage.setItem(AFTERSALES_STORAGE_KEY, previous) } catch { /* best effort rollback */ }
      return false
    }
  }
  const update = (id: string, transform: (record: AfterSaleRecord) => AfterSaleRecord | null) => {
    const records = read()
    const index = records.findIndex((record) => record.id === id)
    if (index < 0) return false
    const nextRecord = transform(records[index])
    if (!nextRecord) return false
    if (nextRecord === records[index]) return true
    const next = records.map(clone)
    next[index] = nextRecord
    return commit(next)
  }
  const external = (event: Event) => {
    if (event instanceof CustomEvent && event.detail?.source === source) return
    if (typeof StorageEvent !== 'undefined' && event instanceof StorageEvent && event.key && event.key !== AFTERSALES_STORAGE_KEY) return
    listeners.forEach((listener) => listener())
  }
  eventTarget?.addEventListener(EVENT, external)
  eventTarget?.addEventListener('storage', external)

  return {
    list() { return read().map(clone).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) },
    get(id: string) { const found = read().find((record) => record.id === id); return found ? clone(found) : undefined },
    findActiveByOrder(orderId: string) { const found = read().find((record) => record.orderId === orderId && ACTIVE.includes(record.status)); return found ? clone(found) : undefined },
    create(order: OrderRecord, input: AfterSaleApplicationInput) {
      const records = read()
      const existing = records.find((record) => record.orderId === order.id && ACTIVE.includes(record.status))
      if (existing) return clone(existing)
      const at = now()
      const stamp = formatDate(at)
      const day = stamp.slice(0, 10).replaceAll('-', '')
      const sequence = String(records.filter((record) => record.id.startsWith(`AS${day}`)).length + 1).padStart(3, '0')
      const record: AfterSaleRecord = {
        id: `AS${day}${sequence}`,
        orderId: order.id,
        productId: order.productId,
        productTitle: order.productTitle,
        gameName: order.gameName,
        server: order.server,
        thumbnail: order.thumbnail,
        status: 'pending_review',
        reviewStage: 'initial',
        kind: input.kind,
        reason: input.reason,
        description: input.description.trim(),
        statusMessage: '售后申请已提交，等待客服审核。',
        refundAmountCents: order.totalAmountCents,
        materialNames: [...input.materialNames],
        createdAt: stamp,
        updatedAt: stamp,
      }
      return commit([record, ...records]) ? clone(record) : undefined
    },
    supplement(id: string, note: string, materialNames: string[]) {
      const trimmed = note.trim()
      if (!trimmed || materialNames.length === 0) return false
      return update(id, (record) => {
        if (record.status !== 'supplement') return null
        const submittedAt = formatDate(now())
        return {
          ...clone(record),
          status: 'pending_review',
          reviewStage: 'resubmitted',
          statusMessage: '补充材料已提交，平台正在重新审核。',
          materialNames: [...(record.materialNames ?? []), ...materialNames],
          supplements: [...(record.supplements ?? []), { note: trimmed, materialNames: [...materialNames], submittedAt }],
          updatedAt: submittedAt,
        }
      })
    },
    withdraw(id: string) {
      return update(id, (record) => record.status === 'pending_review' ? { ...clone(record), status: 'withdrawn', statusMessage: '你已撤销本次售后申请。', updatedAt: formatDate(now()) } : null)
    },
    reopen(id: string) {
      return update(id, (record) => ['withdrawn', 'rejected', 'completed'].includes(record.status) ? { ...clone(record), status: 'pending_review', reviewStage: 'initial', statusMessage: '售后申请已重新提交，等待客服审核。', updatedAt: formatDate(now()) } : null)
    },
    restore(records: readonly AfterSaleRecord[]) { return commit(records.map(clone)) },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    dispose() { eventTarget?.removeEventListener(EVENT, external); eventTarget?.removeEventListener('storage', external); listeners.clear() },
  }
}

function memoryStorage(): AfterSaleStorage {
  const values = new Map<string, string>()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: (key) => { values.delete(key) } }
}

let storage: AfterSaleStorage = getRuntimeStorage()
let eventTarget: Options['eventTarget']
if (typeof window !== 'undefined' && !isLinkedDataMode) eventTarget = window
export const afterSaleRepository = createAfterSaleRepository({ storage, eventTarget })
