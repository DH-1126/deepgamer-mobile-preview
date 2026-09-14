import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createRecycleConsultationSeed } from '../data/recycleFixtures'
import { recyclerFixtures } from '../data/sellFixtures'
import { createRecycleRepository } from '../repository/recycleRepository'
import { createRecycleConversation, createRecyclePaidOrderRecord } from './recycleModel'
import { RecycleHistory } from './RecycleHistory'

const now = new Date(2026, 8, 14, 12).getTime()
const seed = createRecycleConsultationSeed(now, recyclerFixtures)
const order = seed.orders[0]

describe('complete recycle consultation history', () => {
  it('keeps the first consultation identity and unread count, with two distinct quote attempts', () => {
    expect(order).toMatchObject({ id: 'RC-D3-61001', contactName: '买家1', unreadCount: 2, stage: 'completed', historyPreview: true, quoteCents: 2200, protectionFeeCents: 220 })
    const cards = order.messages.flatMap(message => message.historyCard ? [message.historyCard] : [])
    expect(new Set(cards.map(card => card.state))).toEqual(new Set(['unsent', 'pending', 'confirming', 'rejected', 'awaiting_payment', 'preparing_payment', 'ready_payment', 'completed', 'event']))
    const rejected = cards.filter(card => card.state === 'rejected')
    expect(rejected.every(card => card.orderId === `${order.id}-R1` && card.quoteCents === 2000)).toBe(true)
    expect(cards.find(card => card.state === 'completed')).toMatchObject({ orderId: order.id, quoteCents: 2200 })
    const times = order.messages.map(message => message.createdAt)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(times.at(-1)).toBe(order.updatedAt)
    expect(times.every(time => time >= order.createdAt && time <= now)).toBe(true)
    expect(order.sellerConfirmedAt).toBeLessThan(order.paidAt!)
    expect(order.paidAt).toBeLessThan(order.expiresAt)
  })

  it('renders both role amounts, event cards, mentions, all button styles, and one actionable handoff', () => {
    const html = renderToStaticMarkup(<RecycleHistory order={order} onEnterGroup={vi.fn()} />)
    for (const text of ['尚未发送回收单', '修改回收单', '确认中…', '已拒绝', '发送新回收单', '付款凭证准备中', '去付款', '查看完整回收单', '变更类型', '@回收商', '@卖家', '¥22.00', '¥24.20', '¥2.20', '资金进入平台托管']) expect(html).toContain(text)
    const activeButtons = (html.match(/<button\b[^>]*>/g) ?? []).filter(button => !button.includes('disabled=""'))
    expect(activeButtons).toHaveLength(1)
    expect(html).toContain('进入交易群')
    expect(html).not.toContain('<input')
    expect(html).not.toContain('账号已交付')
  })

  it('rejects changes to ended consultation and creates the next trade at materials phase', () => {
    const values = new Map<string, string>()
    const repository = createRecycleRepository({ seed, now: () => now, storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: key => { values.delete(key) } } })
    expect(repository.list()[0].id).toBe(order.id)
    expect(repository.sendMessage(order.id, '不能再发')).toBe(false)
    expect(repository.confirmOrder(order.id)).toBe(false)
    expect(repository.completePayment(order.id)).toBeUndefined()
    expect(repository.reject(order.id)).toBe(false)
    expect(createRecycleConversation(order, now)).toMatchObject({ workflowPhase: 'materials', viewerRole: 'seller', orderAmount: 22, orderId: order.orderId, id: order.conversationId })
    expect(createRecyclePaidOrderRecord(order, now)).toMatchObject({ status: 'paid', goodsAmountCents: 2200, totalAmountCents: 2420, conversationId: order.conversationId })
  })
})
