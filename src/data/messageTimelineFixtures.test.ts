import { describe, expect, it } from 'vitest'
import { filterConversations, formatConversationTime } from '../components/messageModel'
import { createMessageSeed, SUPPORT_CONVERSATION_ID } from './messageFixtures'
import { createRecycleConsultationSeed } from './recycleFixtures'
import { createOrderSeed } from './orderFixtures'
import { recyclerFixtures } from './sellFixtures'
import { ARCHIVED_TRADE_ID } from './archivedTradeFixtures'

const now = new Date(2026, 8, 14, 12, 30).getTime()
const mixedIds = [
  'trade-list-OD3015035674505896501', 'trade-list-OD3015035674505896502',
  'trade-list-OD3015035674505896503', 'trade-list-OD3015035674505896504',
  'trade-list-OD3015035674505896505',
  'RC-D3-61004', 'trade-hpjy', 'trade-sample-inspection', 'trade-wzry-od03',
  'RC-D3-61005', 'trade-sample-materials-buyer', 'RC-D3-33210', 'trade-wzry-od05',
  'trade-wzry', 'trade-delta', 'RC-D3-61002', 'trade-sample-binding',
  'RC-D3-61001', 'trade-sample-materials-seller', 'RC-D3-41206', 'RC-D3-61003',
  'trade-ys', 'RC-D3-50817',
]

function mixedTimeline(at: number) {
  const messages = createMessageSeed(at)
  const recycle = createRecycleConsultationSeed(at, recyclerFixtures)
  return [
    ...filterConversations(messages.conversations, 'all').filter(item => item.kind === 'trade_group'),
    ...recycle.orders,
  ].sort((a, b) => b.updatedAt - a.updatedAt)
}

describe('mixed message timeline fixtures', () => {
  it('uses a stable, irregular chronological mix rather than type blocks or runtime randomness', () => {
    const rows = mixedTimeline(now)
    expect(rows.map(item => item.id)).toEqual(mixedIds)
    expect(mixedTimeline(now).map(item => item.id)).toEqual(mixedIds)
    expect(new Set(rows.map(item => item.updatedAt)).size).toBe(rows.length)
    expect(rows.every((row, index) => !index || row.updatedAt < rows[index - 1].updatedAt)).toBe(true)
    expect(rows.some(item => item.id === SUPPORT_CONVERSATION_ID)).toBe(false)
  })

  it('supplies distinct times today and examples of yesterday, older dates and last year', () => {
    const labels = mixedTimeline(now).map(item => formatConversationTime(item.updatedAt, now))
    expect(labels.slice(0, 14)).toEqual(['12:30', '12:29', '12:29', '12:29', '12:29', '12:26', '12:19', '12:09', '11:51', '11:42', '11:27', '10:55', '10:13', '09:37'])
    expect(labels).toEqual(expect.arrayContaining(['昨天', '09-12', '09-11', '09-09', '09-07', '09-05', '2025']))
  })

  it.each([now, new Date(2026, 0, 1, 0, 1).getTime()])('keeps chat history and linked order times consistent at %s', at => {
    const messages = createMessageSeed(at)
    const orders = createOrderSeed(at)
    for (const conversation of messages.conversations) {
      expect(conversation.updatedAt).toBeLessThanOrEqual(at)
      const history = messages.messages.filter(item => item.conversationId === conversation.id)
      if (history.length) {
        expect(history.at(-1)?.createdAt).toBe(conversation.updatedAt)
        expect(history.map(item => item.createdAt)).toEqual(history.map(item => item.createdAt).sort((a, b) => a - b))
      }
      const order = orders.find(item => item.id === conversation.orderId)
      if (order) expect(order.createdAt).toBeLessThanOrEqual(history[0]?.createdAt ?? conversation.updatedAt)
    }
    const archived = messages.conversations.find(item => item.id === ARCHIVED_TRADE_ID)!
    const completed = orders.find(item => item.id === archived.orderId)!
    expect(archived.historyPreview && archived.closed).toBe(true)
    expect(archived.updatedAt - completed.updatedAt).toBe(7 * 24 * 60 * 60_000)
    for (const order of createRecycleConsultationSeed(at, recyclerFixtures).orders) {
      expect(order.messages[0].createdAt).toBe(order.createdAt)
      expect(order.messages.at(-1)?.createdAt).toBe(order.updatedAt)
      expect(order.messages.map(item => item.createdAt)).toEqual(order.messages.map(item => item.createdAt).sort((a, b) => a - b))
      expect(order.updatedAt).toBeLessThanOrEqual(at)
      if (order.sellerConfirmedAt) expect(order.sellerConfirmedAt).toBeGreaterThanOrEqual(order.createdAt)
      if (order.paidAt) {
        expect(order.paidAt).toBeGreaterThan(order.sellerConfirmedAt!)
        expect(order.paidAt).toBeLessThanOrEqual(order.updatedAt)
        expect(order.paidAt).toBeLessThan(order.expiresAt)
      }
    }
  })
})
