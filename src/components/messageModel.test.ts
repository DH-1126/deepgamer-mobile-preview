import { describe, expect, it } from 'vitest'
import { createMessageSeed } from '../data/messageFixtures'
import { canAdvanceBinding, canSendQuick, createPendingMessage, filterConversations, getMessageSummary, groupTradeConversations, markDelivery, validateMessageText } from './messageModel'

describe('messageModel', () => {
  const now = 2_000_000_000_000
  const store = createMessageSeed(now)

  it('默认任务、交易群与未读计数符合契约', () => {
    expect(getMessageSummary(store)).toEqual({ unreadCount: 3, groupCount: 4, taskCount: 2 })
    expect(store.conversations.filter((item) => item.kind === 'trade_group')).toHaveLength(5)
  })

  it('全部隐藏关闭项，交易群按2/2/1分组', () => {
    expect(filterConversations(store.conversations, 'all').some((item) => item.stage === 'closed')).toBe(false)
    const groups = groupTradeConversations(filterConversations(store.conversations, 'groups'))
    expect([groups.need_action.length, groups.in_progress.length, groups.closed.length]).toEqual([2, 2, 1])
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
