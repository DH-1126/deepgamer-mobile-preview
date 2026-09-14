import type { Recycler, SellGame, SellGameCode } from '../types/sell'
import type { RecycleOrder, RecycleStore } from '../types/recycle'
import { withRecycleHistory } from './recycleHistoryFixtures'

export const SELL_SELECTION_STORAGE_KEY = 'deepgamer.sell.selection.v1'
export const RECYCLE_STORAGE_KEY = 'deepgamer.recycle.v2'
export const LEGACY_RECYCLE_STORAGE_KEY = 'deepgamer.recycle.v1'

const gameFallback: Record<SellGameCode, Pick<SellGame, 'name'>> = {
  wzry: { name: '王者荣耀' }, peace: { name: '和平精英' }, genshin: { name: '原神' }, delta: { name: '三角洲' }, identity: { name: '第五人格' }, valorant: { name: '无畏契约' }, egg: { name: '蛋仔派对' }, starrail: { name: '崩坏星穹' }, naruto: { name: '火影忍者' },
}

function messages(now: number, mark = '趣') {
  return [
    { id: `m-${now}-1`, sender: 'recycler' as const, content: '这个号想出的话，我先帮你看看大概价格。', createdAt: now - 240_000 },
    { id: `m-${now}-2`, sender: 'user' as const, content: '收到，我先说明下账号的大致情况。', createdAt: now - 180_000 },
    { id: `m-${now}-3`, sender: 'recycler' as const, content: `${mark}：可以，确认报价后我会发正式回收单。`, createdAt: now - 120_000 },
  ]
}

export function createRecycleOrder(recycler: Recycler, now: number, gameCode: SellGameCode = 'wzry'): RecycleOrder {
  const gameName = gameFallback[gameCode].name
  return {
    id: `RC-${String(now).slice(-8)}`,
    gameCode, gameName, server: gameCode === 'wzry' ? 'QQ区' : '默认区服', rank: '账号情况待沟通',
    recyclerId: recycler.id, recyclerName: recycler.name, quoteCents: 0,
    unreadCount: 0,
    stage: 'consulting', expiresAt: now + 30 * 60 * 1000, createdAt: now, updatedAt: now,
    materials: [
      { key: 'camp_id', label: '游戏角色信息', detail: '旧版兼容字段', completed: true, value: '已在咨询中说明' },
      { key: 'battle_screenshot', label: '账号截图', detail: '旧版兼容字段', completed: false },
      { key: 'platform_binding', label: '平台绑定', detail: '旧版兼容字段', completed: false },
    ],
    messages: messages(now, recycler.mark),
  }
}

function sampleOrder(base: RecycleOrder, changes: Partial<RecycleOrder>): RecycleOrder {
  return { ...base, ...changes, materials: base.materials.map((item) => ({ ...item })), messages: base.messages.map((item) => ({ ...item })) }
}

/** Design-only consultation samples used by recycle lists; no passwords, phones or PII. */
export function createRecycleConsultationSeed(now: number, recyclers: Recycler[]): RecycleStore {
  const fun = recyclers.find((item) => item.id === 'fun') ?? recyclers[0]
  const steady = recyclers.find((item) => item.id === 'steady') ?? recyclers[0]
  if (!fun || !steady) return { activeOrderId: null, orders: [] }
  const make = (recycler: Recycler, minutesAgo: number, gameCode: SellGameCode, changes: Partial<RecycleOrder>) => {
    const base = createRecycleOrder(recycler, now - minutesAgo * 60_000, gameCode)
    const order = sampleOrder(base, { ...changes, updatedAt: now - minutesAgo * 60_000 })
    return { ...order, createdAt: order.messages[0].createdAt, messages: [...order.messages.slice(0, -1), { ...order.messages.at(-1)!, id: `last-${order.id}`, content: changes.messages?.at(-1)?.content ?? order.messages.at(-1)!.content, createdAt: order.updatedAt }] }
  }
  const consultingCopy = (content: string) => [{ id: 'fixture-copy', sender: 'recycler' as const, content, createdAt: now }]
  // Stable, irregular timestamps mix both conversation types without reshuffling on render.
  const completedAt = new Date(new Date(now).getFullYear() - 1, 10, 18, 16, 42).getTime()
  const buyer1 = make(fun, 2 * 24 * 60 + 77, 'wzry', { id: 'RC-D3-61001', contactName: '买家1', unreadCount: 2, stage: 'consulting', messages: consultingCopy('回收商：可以继续说下账号大致情况。') })
  const recycler1 = make(fun, 95, 'wzry', { id: 'RC-D3-33210', contactName: '回收商1', unreadCount: 5, quoteCents: 2200, protectionFeeCents: 220, server: 'QQ区', rank: '高段位 · 账号描述已确认', stage: 'formal', expiresAt: now + 30 * 60_000, messages: consultingCopy('回收商：正式回收单已发送，等待确认。') })
  const buyer2 = make(steady, 25 * 60 + 8, 'peace', { id: 'RC-D3-61002', contactName: '买家2', unreadCount: 1, stage: 'formal', quoteCents: 3600, protectionFeeCents: 360, expiresAt: now + 25 * 60_000, messages: consultingCopy('回收商：正式回收单已发送，请查看并确认。') })
  const recycler2 = make(steady, 5 * 24 * 60 + 43, 'peace', { id: 'RC-D3-41206', contactName: '回收商2', unreadCount: 3, quoteCents: 2200, protectionFeeCents: 220, server: '微信区', rank: '账号描述已确认', stage: 'submitted', expiresAt: now + 28 * 60_000, sellerConfirmedAt: now - (5 * 24 * 60 + 45) * 60_000, messages: consultingCopy('平台：回收单已确认，等待回收商处理。') })
  const buyer3 = make(fun, 7 * 24 * 60 + 121, 'genshin', { id: 'RC-D3-61003', contactName: '买家3', unreadCount: 2, stage: 'consulting', messages: consultingCopy('回收商：收到账号概况，我们继续沟通细节。') })
  const recycler3 = make(steady, 4, 'delta', { id: 'RC-D3-61004', contactName: '回收商3', unreadCount: 4, stage: 'consulting', messages: consultingCopy('回收商：还需要了解一些账号情况，可以继续沟通。') })
  const buyer4 = make(fun, 48, 'identity', { id: 'RC-D3-61005', contactName: '买家4', unreadCount: 1, stage: 'formal', quoteCents: 3100, protectionFeeCents: 310, expiresAt: now + 15 * 60_000, messages: consultingCopy('回收商：正式回收单已发送，等待确认。') })
  const recycler4 = make(fun, (now - completedAt) / 60_000, 'genshin', { id: 'RC-D3-50817', contactName: '回收商4', unreadCount: 6, quoteCents: 6800, protectionFeeCents: 680, server: '天空岛服', rank: '账号描述已确认', stage: 'completed', expiresAt: completedAt + 28 * 60_000, sellerConfirmedAt: completedAt - 2 * 60_000, paidAt: completedAt - 60_000, conversationId: 'trade-recycle-RC-D3-50817', orderId: 'OD-RC-D3-50817', messages: consultingCopy('平台：回收商付款已完成，可进入交易群继续交易。') })
  return { activeOrderId: recycler1.id, orders: [withRecycleHistory(buyer1), recycler1, buyer2, recycler2, buyer3, recycler3, buyer4, recycler4] }
}
