import { describe, expect, it } from 'vitest'
import { createMessageSeed } from '../data/messageFixtures'
import { canAdvanceBinding, canSendQuick, createPendingMessage, filterConversations, formatConversationTime, getMessageSummary, groupTradeConversations, markDelivery, validateMessageText } from './messageModel'

describe('messageModel', () => {
  const now = 2_000_000_000_000
  const store = createMessageSeed(now)

  it('默认任务、交易群与未读计数符合契约', () => {
    expect(getMessageSummary(store)).toEqual({ unreadCount: 17, groupCount: 18, taskCount: 9 })
    expect(store.conversations.filter((item) => item.kind === 'trade_group')).toHaveLength(27)
  })

  it('全部隐藏关闭项，新增订单交易群按9/9/9分组', () => {
    expect(filterConversations(store.conversations, 'all').some((item) => item.stage === 'closed')).toBe(false)
    const groups = groupTradeConversations(filterConversations(store.conversations, 'groups'))
    expect([groups.need_action.length, groups.in_progress.length, groups.closed.length]).toEqual([9, 9, 9])
    expect(filterConversations(store.conversations, 'notifications').map((item) => item.id)).toEqual(['system-notice'])
  })

  it('支持19位订单号和商品编号搜索', () => {
    expect(filterConversations(store.conversations, 'all', 'OD20260821000000001')[0]?.id).toBe('trade-wzry')
    expect(filterConversations(store.conversations, 'all', 'SJ11DG001')[0]?.id).toBe('trade-delta')
  })

  it('校验1000字、消息发送状态和快捷操作冷却', () => {
    expect(validateMessageText('   ')).toBe('请输入消息')
    expect(validateMessageText('a'.repeat(1001))).toBe('消息不能超过1000字')
    expect(validateMessageText('好的')).toBe('')
    const pending = createPendingMessage('trade-wzry', ' 好的 ', now, 'local-1')
    expect(pending).toMatchObject({ content: '好的', delivery: 'sending' })
    expect(markDelivery(pending, 'failed').delivery).toBe('failed')
    expect(canSendQuick(now - 9999, now)).toBe(false)
    expect(canSendQuick(now - 10000, now)).toBe(true)
  })

  it('只有换绑中的未关闭交易可以推进', () => {
    expect(canAdvanceBinding(store.conversations[0])).toBe(true)
    expect(canAdvanceBinding(store.conversations.find((item) => item.stage === 'closed')!)).toBe(false)
  })
})

describe('conversation time labels', () => {
  const now = new Date(2026, 8, 14, 12).getTime()
  it.each([
    [new Date(2026, 8, 14, 9, 5).getTime(), '09:05'],
    [new Date(2026, 8, 14, 0, 0).getTime(), '00:00'],
    [new Date(2026, 8, 13, 23, 59).getTime(), '昨天'],
    [new Date(2026, 8, 13, 0, 1).getTime(), '昨天'],
    [new Date(2026, 8, 12, 23, 59).getTime(), '09-12'],
    [new Date(2026, 0, 2, 9).getTime(), '01-02'],
    [new Date(2025, 11, 31, 23, 59).getTime(), '2025'],
    [new Date(2024, 0, 1, 9).getTime(), '2024'],
  ])('formats %s as %s', (timestamp, expected) => {
    expect(formatConversationTime(timestamp, now)).toBe(expected)
  })

  it('uses yesterday across a month or year boundary, even just minutes after midnight', () => {
    expect(formatConversationTime(new Date(2026, 7, 31, 23, 59).getTime(), new Date(2026, 8, 1, 0, 1).getTime())).toBe('昨天')
    expect(formatConversationTime(new Date(2025, 11, 31, 23, 59).getTime(), new Date(2026, 0, 1, 0, 1).getTime())).toBe('昨天')
    expect(formatConversationTime(new Date(2025, 11, 30, 23, 59).getTime(), new Date(2026, 0, 1, 0, 1).getTime())).toBe('2025')
  })

  it('does not render an invalid date', () => {
    expect(formatConversationTime(NaN, now)).toBe('--')
    expect(formatConversationTime(Infinity, now)).toBe('--')
  })
})
