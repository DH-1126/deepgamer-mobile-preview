import { describe, expect, it } from 'vitest'
import { createTradeMessageSeed } from './tradeMessageFixtures'
import { createMessageSeed } from './messageFixtures'
import { createOrderSeed } from './orderFixtures'
import { filterConversations, formatConversationTime, getMessageSummary } from '../components/messageModel'
import { getTradeConversationStatus } from '../components/tradeConversationStatus'
import { getOrderWorkflowPhase } from '../components/orderModel'
import { isOrderConversationMatch } from '../components/tradeFlowModel'
import { createMessageRepository, type MessageStorage } from '../repository/messageRepository'

const now = new Date(2026, 8, 14, 12, 30).getTime()

describe('additional transaction message examples', () => {
  it('adds six independent orders, conversations and thirty messages without changing legacy IDs', () => {
    const samples = createTradeMessageSeed(now)
    const messages = createMessageSeed(now)
    const orders = createOrderSeed(now)
    expect(samples.orders).toHaveLength(6)
    expect(samples.conversations).toHaveLength(6)
    expect(samples.messages).toHaveLength(30)
    expect(messages.conversations.filter(item => item.kind === 'trade_group')).toHaveLength(27)
    expect(new Set(messages.conversations.map(item => item.id)).size).toBe(messages.conversations.length)
    expect(new Set(messages.messages.map(item => item.id)).size).toBe(messages.messages.length)
    expect(new Set(orders.map(item => item.id)).size).toBe(orders.length)
    expect(new Set(orders.map(item => item.conversationId)).size).toBe(orders.length)
    expect(orders.find(item => item.id === 'OD20260821000000003')?.conversationId).toBe('trade-wzry-od03')
  })

  it('covers all ten badges and the four shared visual tones with actual linked orders', () => {
    const orders = createOrderSeed(now)
    const states = createMessageSeed(now).conversations.filter(item => item.kind === 'trade_group')
      .map(item => getTradeConversationStatus(item, orders.find(order => order.id === item.orderId)))
    expect(new Set(states.map(item => item.label))).toEqual(new Set(['待付款', '资料同步', '验号', '换绑', '签署完成', '投保中', '投保成功', '确认放款', '完成', '关闭']))
    expect(new Set(states.map(item => item.tone))).toEqual(new Set(['warning', 'info', 'success', 'neutral']))
  })

  it('keeps each chat, order, phase, amount and latest-message timestamp in sync', () => {
    const samples = createTradeMessageSeed(now)
    for (const conversation of samples.conversations) {
      const order = samples.orders.find(item => item.id === conversation.orderId)!
      const messages = samples.messages.filter(item => item.conversationId === conversation.id)
      expect(isOrderConversationMatch(order, conversation, conversation.orderId!)).toBe(true)
      expect(conversation.workflowOrderId).toBe(order.id)
      expect(conversation.workflowPhase).toBe(getOrderWorkflowPhase(order.status))
      expect(conversation.orderAmount).toBe(order.totalAmountCents / 100)
      expect(messages).toHaveLength(5)
      expect(messages.map(item => item.createdAt)).toEqual(messages.map(item => item.createdAt).sort((a, b) => a - b))
      expect(messages.every(item => item.createdAt >= order.createdAt && item.createdAt <= now)).toBe(true)
      expect(messages.at(-1)?.createdAt).toBe(conversation.updatedAt)
      expect(conversation.lastMessage).toBe(`萌萌：${messages.at(-1)?.content}`)
      expect(messages.some(item => ['m1', 'm2', 'm3', 'm4'].includes(item.id))).toBe(false)
    }
  })

  it('supplies different unread counts, games, timestamps and searchable product codes', () => {
    const { conversations } = createTradeMessageSeed(now)
    expect(conversations.map(item => item.unreadCount)).toEqual([3, 1, 4, 2, 1, 0])
    expect(new Set(conversations.map(item => item.gameCode))).toEqual(new Set(['wzry', 'hpjy', 'sjzxd', 'ys']))
    expect(conversations.map(item => formatConversationTime(item.updatedAt, now))).toEqual(['09-11', '11:27', '12:09', '昨天', '09-08', '2025'])
    expect(filterConversations(conversations, 'groups', 'HP091403').map(item => item.id)).toEqual(['trade-sample-inspection'])
    expect(filterConversations(conversations, 'groups', '不存在的商品')).toEqual([])
  })

  it('clears only the opened group unread count and retains the conversations across reads', async () => {
    const values = new Map<string, string>()
    const storage: MessageStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: key => { values.delete(key) } }
    const repository = createMessageRepository({ storage, now: () => now })
    const before = repository.getSnapshot()
    expect(getMessageSummary(before).unreadCount).toBe(17)
    expect(await repository.markRead('trade-sample-inspection')).toBe(true)
    expect(getMessageSummary(repository.getSnapshot()).unreadCount).toBe(13)
    expect((await repository.get('trade-sample-inspection'))?.unreadCount).toBe(0)
    const otherConversations = (conversations: typeof before.conversations) => conversations.filter(item => item.id !== 'trade-sample-inspection')
    expect(otherConversations(repository.getSnapshot().conversations)).toEqual(otherConversations(before.conversations))
    expect(await repository.listMessages('trade-sample-inspection')).toHaveLength(5)
    expect((await repository.sendText('trade-sample-closed', '你好')).ok).toBe(false)
  })
})
