import { describe, expect, it } from 'vitest'
import { createMessageSeed } from '../data/messageFixtures'
import { createOrderSeed } from '../data/orderFixtures'
import { getTradeConversationStatus, tradeConversationStatuses } from './tradeConversationStatus'

const now = 2_000_000_000_000
const base = createMessageSeed(now).conversations[0]
const order = createOrderSeed(now)[0]

describe('trade conversation list status', () => {
  it.each([
    ['pending', '待付款', 'warning'], ['paid', '资料同步', 'info'], ['verifying', '验号', 'info'],
    ['binding', '换绑', 'info'], ['bind_success', '确认放款', 'info'], ['completed', '完成', 'success'],
    ['closed', '关闭', 'neutral'], ['cancelled', '关闭', 'neutral'], ['pay_expired', '关闭', 'neutral'],
  ] as const)('maps the associated %s order to %s, regardless of stale conversation labels', (status, label, tone) => {
    expect(getTradeConversationStatus({ ...base, progressLabel: '换绑超时', workflowPhase: 'materials' }, { ...order, status })).toMatchObject({ label, tone })
  })

  it('uses exactly four visual treatments across the seven stages', () => {
    expect(Object.values(tradeConversationStatuses).map(item => item.label)).toEqual(['待付款', '资料同步', '验号', '换绑', '确认放款', '完成', '关闭'])
    expect(new Set(Object.values(tradeConversationStatuses).map(item => item.tone)).size).toBe(4)
  })

  it.each([
    ['materials', '资料同步'], ['inspection', '验号'], ['binding', '换绑'], ['release', '确认放款'], ['completed', '完成'], ['closed', '关闭'],
  ] as const)('falls back to the conversation phase %s when no associated order exists', (workflowPhase, label) => {
    expect(getTradeConversationStatus({ ...base, workflowPhase }).label).toBe(label)
  })

  it.each(['materials', 'inspection', 'binding', 'release'] as const)('keeps the original %s phase for paused conversations without inventing another list status', pausedPhase => {
    expect(getTradeConversationStatus({ ...base, workflowPhase: 'paused', pausedPhase })).toMatchObject({ status: pausedPhase, tone: 'info' })
  })

  it('does not copy the payment state of a different order or conversation', () => {
    expect(getTradeConversationStatus(base, { ...order, id: 'another-order' }).status).toBe('materials')
    expect(getTradeConversationStatus(base, { ...order, conversationId: 'another-conversation' }).status).toBe('materials')
    expect(getTradeConversationStatus({ ...base, workflowOrderId: 'another-order' }, order).status).toBe('materials')
  })

  it('distinguishes completed conversations from closed conversations even when both are read-only', () => {
    expect(getTradeConversationStatus({ ...base, workflowPhase: 'completed', closed: true }).status).toBe('completed')
    expect(getTradeConversationStatus({ ...base, workflowPhase: undefined, closed: true }).status).toBe('closed')
  })
})
