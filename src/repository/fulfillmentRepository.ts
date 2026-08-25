import type { FulfillmentContract } from '../types/fulfillment'

const storageKey = 'deepgamer.fulfillment.v2'
const eventName = 'deepgamer:fulfillment'

const seed: FulfillmentContract = {
  id: 'RC-2608-4471', conversationId: 'trade-wzry', orderId: 'OD20260821000000001', orderNo: 'RC-2608-4471',
  gameName: '王者荣耀', serverName: 'QQ区', recyclerName: '真趣十足', amountCents: 20000,
  signerMasked: '李**（已实名）', identityMasked: '3301**********2417', status: 'pending',
}

function read(): FulfillmentContract {
  try { const raw = localStorage.getItem(storageKey); return raw ? JSON.parse(raw) as FulfillmentContract : seed } catch { return seed }
}

function write(contract: FulfillmentContract) {
  localStorage.setItem(storageKey, JSON.stringify(contract))
  window.dispatchEvent(new CustomEvent(eventName))
}

export const fulfillmentRepository = {
  async getByConversation(conversationId: string) { const contract = read(); return contract.conversationId === conversationId ? contract : undefined },
  async get(id: string) { const contract = read(); return contract.id === id ? contract : undefined },
  async sign(id: string, signature: string) {
    const current = read()
    if (current.id !== id || current.status === 'signed' || !signature.trim()) return current
    const next = { ...current, status: 'signed' as const, signature: signature.trim(), signedAt: Date.now() }
    write(next); return next
  },
  subscribe(listener: () => void) {
    const handler = () => listener(); window.addEventListener(eventName, handler); window.addEventListener('storage', handler)
    return () => { window.removeEventListener(eventName, handler); window.removeEventListener('storage', handler) }
  },
}
