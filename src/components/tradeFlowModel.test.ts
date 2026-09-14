import { describe, expect, it } from 'vitest'
import { createMessageSeed } from '../data/messageFixtures'
import { createOrderSeed } from '../data/orderFixtures'
import { getConversationPhase, getTradeStep, isOrderConversationMatch, isTradePreviewMode, nextTradePhase, validateTradeIssue } from './tradeFlowModel'

describe('四步交易履约', () => {
  it('只有当前责任人可以推进流程', () => {
    expect(nextTradePhase('materials', 'buyer', 'submit_materials')).toBeNull()
    expect(nextTradePhase('materials', 'seller', 'submit_materials')).toBe('inspection')
    expect(nextTradePhase('inspection', 'buyer', 'finish_inspection')).toBe('binding')
    expect(nextTradePhase('binding', 'seller', 'finish_binding')).toBe('release')
    expect(nextTradePhase('release', 'buyer', 'release_funds')).toBe('completed')
  })
  it('异常暂停保留原步骤，且禁止继续放款', () => {
    expect(nextTradePhase('release', 'buyer', 'report_issue')).toBe('paused')
    expect(getTradeStep('paused', 'release')).toBe(4)
    expect(nextTradePhase('paused', 'buyer', 'release_funds')).toBeNull()
    expect(nextTradePhase('completed', 'seller', 'report_issue')).toBeNull()
  })
  it('异常描述不能为空，不能超出设计长度', () => {
    expect(validateTradeIssue('', '说明')).toBeTruthy()
    expect(validateTradeIssue('无法登录', ' ')).toBeTruthy()
    expect(validateTradeIssue('无法登录', 'a'.repeat(501))).toBeTruthy()
    expect(validateTradeIssue('无法登录', '账号无法登录，请协助核查')).toBe('')
  })
  it('只有订单、会话和路由三方一致才可持久化操作', () => {
    const now = 2_000_000_000_000
    const order = createOrderSeed(now).find(item => item.id === 'OD20260821000000003')!
    const conversation = createMessageSeed(now).conversations.find(item => item.id === 'trade-wzry-od03')!
    expect(isOrderConversationMatch(order, conversation, order.id)).toBe(true)
    expect(isOrderConversationMatch(order, conversation, 'OD20260821000000001')).toBe(false)
    expect(isOrderConversationMatch({ ...order, conversationId: 'trade-wzry' }, conversation, order.id)).toBe(false)
  })
  it('预览参数需有显式场景或合法阶段', () => {
    expect(isTradePreviewMode(null, null)).toBe(false)
    expect(isTradePreviewMode('preview', null)).toBe(true)
    expect(isTradePreviewMode(null, 'completed')).toBe(true)
    expect(isTradePreviewMode(null, 'unknown')).toBe(false)
  })
  it('旧会话不再根据固定 id 猜测已可放款', () => {
    expect(getConversationPhase({ ...createMessageSeed(1).conversations[0], workflowPhase: undefined, tradeState: undefined })).toBe('materials')
  })
})
