import { createInitialWalletSnapshot, WALLET_STORAGE_KEY } from '../data/walletFixtures'
import type { WalletSnapshot, WalletTransaction, WalletWithdrawalResult } from '../types/wallet'

export type WalletStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Options = { storage: WalletStorage; now?: () => number; eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'> }
const EVENT = 'deepgamer:wallet-change'

function clone(snapshot: WalletSnapshot): WalletSnapshot {
  return { ...snapshot, completedOrderEarnings: snapshot.completedOrderEarnings.map((item) => ({ ...item })), transactions: snapshot.transactions.map((item) => ({ ...item })) }
}

function parseSnapshot(raw: string | null): WalletSnapshot | undefined {
  if (!raw) return undefined
  try {
    const value = JSON.parse(raw) as WalletSnapshot
    if (![value.availableCents, value.pendingCents, value.frozenCents, value.withdrawnCents].every(Number.isFinite) || !Array.isArray(value.completedOrderEarnings) || !Array.isArray(value.transactions)) return undefined
    return clone(value)
  } catch { return undefined }
}

export function createWalletRepository({ storage, now = Date.now, eventTarget }: Options) {
  const listeners = new Set<() => void>()
  const source = Math.random().toString(36).slice(2)
  const read = () => parseSnapshot(storage.getItem(WALLET_STORAGE_KEY)) ?? createInitialWalletSnapshot()
  const notify = () => listeners.forEach((listener) => listener())
  const commit = (snapshot: WalletSnapshot) => {
    try {
      storage.setItem(WALLET_STORAGE_KEY, JSON.stringify(snapshot))
      notify()
      if (eventTarget && typeof CustomEvent !== 'undefined') eventTarget.dispatchEvent(new CustomEvent(EVENT, { detail: { source } }))
      return true
    } catch { return false }
  }
  const external = (event: Event) => {
    if (event instanceof CustomEvent && event.detail?.source === source) return
    if (typeof StorageEvent !== 'undefined' && event instanceof StorageEvent && event.key && event.key !== WALLET_STORAGE_KEY) return
    notify()
  }
  eventTarget?.addEventListener(EVENT, external)
  eventTarget?.addEventListener('storage', external)

  return {
    getSnapshot: () => clone(read()),
    getTransaction(id: string) { return read().transactions.find((item) => item.id === id) },
    requestWithdrawal(amountCents: number): WalletWithdrawalResult {
      const current = read()
      if (!Number.isSafeInteger(amountCents) || amountCents < 100) return { ok: false, error: '提现金额无效' }
      if (amountCents > current.availableCents) return { ok: false, error: '可用余额不足' }
      const submittedAt = now()
      const transactionId = `WD${submittedAt}`
      if (current.transactions.some((item) => item.id === transactionId)) return { ok: false, error: '请勿重复提交提现申请' }
      const nextAvailable = current.availableCents - amountCents
      const transaction: WalletTransaction = {
        id: transactionId, kind: 'withdrawal', direction: 'expense', status: 'pending', title: '提现申请扣款',
        description: '财务审核中，预计1个工作日内处理', amountCents, occurredAt: new Date(submittedAt).toISOString(),
        availableAfterCents: nextAvailable, channel: '支付宝（尾号0033）',
      }
      const next: WalletSnapshot = { ...current, availableCents: nextAvailable, frozenCents: current.frozenCents + amountCents, transactions: [transaction, ...current.transactions] }
      return commit(next) ? { ok: true, transactionId } : { ok: false, error: '提现申请保存失败，请重试' }
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    reset() { try { storage.removeItem(WALLET_STORAGE_KEY); notify(); return true } catch { return false } },
    dispose() { eventTarget?.removeEventListener(EVENT, external); eventTarget?.removeEventListener('storage', external); listeners.clear() },
  }
}

function memoryStorage(): WalletStorage {
  const values = new Map<string, string>()
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: (key) => { values.delete(key) } }
}

let storage: WalletStorage = memoryStorage()
let eventTarget: Options['eventTarget']
if (typeof window !== 'undefined') { try { storage = window.localStorage; eventTarget = window } catch { /* Storage may be unavailable in private mode. */ } }
export const walletRepository = createWalletRepository({ storage, eventTarget })
