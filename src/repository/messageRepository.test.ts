import { describe, expect, it, vi } from 'vitest'
import { createMessageSeed, MESSAGES_STORAGE_KEY, SUPPORT_CONVERSATION_ID } from '../data/messageFixtures'
import { ARCHIVED_TRADE_ID } from '../data/archivedTradeFixtures'
import type { MessageStorage } from './messageRepository'
import { createMessageRepository } from './messageRepository'

function fakeStorage(initial: Record<string, string> = {}): MessageStorage & { values: Map<string, string>; fail: boolean } {
  const values = new Map(Object.entries(initial))
  return {
    values, fail: false,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) { if (this.fail) throw new Error('quota'); values.set(key, value) },
    removeItem: (key) => { values.delete(key) },
  }
}

describe('messageRepository', () => {
  it('旧演示数据自动补齐完整关闭会话，保留既有消息和未读，重复读取不重复添加', async () => {
    const at = 2_000_000_000_000
    const seed = createMessageSeed(at)
    const legacy = { ...seed, conversations: seed.conversations.filter(item => item.id !== ARCHIVED_TRADE_ID), messages: seed.messages.filter(item => item.conversationId !== ARCHIVED_TRADE_ID) }
    legacy.conversations[0] = { ...legacy.conversations[0], lastMessage: '保留当前沟通内容', unreadCount: 9 }
    const storage = fakeStorage({ [MESSAGES_STORAGE_KEY]: JSON.stringify(legacy) })
    const repository = createMessageRepository({ storage, now: () => at })
    const updated = await repository.list()
    expect(updated.filter(item => item.id === ARCHIVED_TRADE_ID)).toHaveLength(1)
    expect(updated.filter(item => item.id !== ARCHIVED_TRADE_ID)).toEqual(legacy.conversations)
    expect(await repository.listMessages(ARCHIVED_TRADE_ID)).toHaveLength(38)
    expect(repository.getSnapshot().messages.filter(item => item.conversationId !== ARCHIVED_TRADE_ID)).toEqual(legacy.messages)
    expect(await repository.markRead(ARCHIVED_TRADE_ID)).toBe(true)
    const reopened = createMessageRepository({ storage, now: () => at + 100000 })
    expect(await reopened.list()).toEqual(updated)
    expect(await reopened.listMessages(ARCHIVED_TRADE_ID)).toHaveLength(38)
  })

  it('不向非内置会话存储注入历史演示数据', async () => {
    const custom = { ...createMessageSeed(2_000_000_000_000).conversations[0], id: 'custom-trade', orderId: 'custom-order' }
    const repository = createMessageRepository({ storage: fakeStorage({ [MESSAGES_STORAGE_KEY]: JSON.stringify({ conversations: [custom], messages: [], notifications: [] }) }) })
    expect(await repository.list()).toEqual([custom])
  })

  it('仅在key缺失时seed，持久空不重灌', async () => {
    const storage = fakeStorage()
    const repository = createMessageRepository({ storage, now: () => 2_000_000_000_000 })
    expect(await repository.list()).toHaveLength(26)
    const empty = fakeStorage({ [MESSAGES_STORAGE_KEY]: JSON.stringify({ conversations: [], messages: [] }) })
    expect(await createMessageRepository({ storage: empty }).list()).toEqual([])
  })

  it('旧消息种子保留别名并补齐每订单唯一会话', async () => {
    const seed = createMessageSeed(2_000_000_000_000)
    const legacy = {
      conversations: seed.conversations
        .filter(item => !['trade-wzry-od03', 'trade-wzry-od05'].includes(item.id))
        .map(item => item.id === 'trade-hpjy' ? { ...item, orderId: 'OD20260821000000003' } : item.id === 'trade-delta' ? { ...item, orderId: 'OD20260820000000002' } : item),
      messages: seed.messages.map(item => ['m1', 'm2', 'm3', 'm4'].includes(item.id) ? { ...item, conversationId: 'trade-wzry' } : item),
    }
    const repository = createMessageRepository({ storage: fakeStorage({ [MESSAGES_STORAGE_KEY]: JSON.stringify(legacy) }), now: () => 2_000_000_000_000 })
    expect(await repository.list()).toHaveLength(26)
    expect(await repository.get('trade-wzry')).toMatchObject({ orderId: 'OD20260821000000001', workflowPhase: 'materials' })
    expect(await repository.get('trade-wzry-od03')).toMatchObject({ orderId: 'OD20260821000000003', workflowPhase: 'release' })
    expect((await repository.listMessages('trade-wzry-od03')).filter(item => ['m1', 'm2', 'm3', 'm4'].includes(item.id))).toHaveLength(4)
  })

  it('内置平台客服会话可直接进入并发送消息', async () => {
    const repository = createMessageRepository({ storage: fakeStorage(), now: () => 2_000_000_000_000 })
    expect(await repository.get(SUPPORT_CONVERSATION_ID)).toMatchObject({ id: SUPPORT_CONVERSATION_ID, kind: 'support', title: '萌萌' })
    expect((await repository.listMessages(SUPPORT_CONVERSATION_ID))[0]).toMatchObject({ sender: 'support', senderName: '萌萌 · 平台客服' })
    expect((await repository.sendText(SUPPORT_CONVERSATION_ID, '我想咨询交易流程')).ok).toBe(true)
  })

  it('打开会话标已读并同步badge，全部已读清零', async () => {
    const repository = createMessageRepository({ storage: fakeStorage(), now: () => 2_000_000_000_000 })
    expect((await repository.summary()).unreadCount).toBe(17)
    expect(await repository.markRead('trade-hpjy')).toBe(true)
    expect((await repository.summary()).unreadCount).toBe(15)
    expect(await repository.markAllRead()).toBe(true)
    expect((await repository.summary()).unreadCount).toBe(0)
  })

  it('发送文本持久化、通知订阅，关闭会话不可发送', async () => {
    const repository = createMessageRepository({ storage: fakeStorage(), now: () => 12345 })
    const listener = vi.fn(); repository.subscribe(listener)
    const result = await repository.sendText('trade-wzry', '请尽快处理', 'local-a')
    expect(result).toMatchObject({ ok: true, message: { delivery: 'sent', content: '请尽快处理' } })
    expect((await repository.listMessages('trade-wzry')).at(-1)?.id).toBe('local-a')
    expect(listener).toHaveBeenCalled()
    expect((await repository.sendText('trade-ys-closed', '测试')).ok).toBe(false)
  })

  it('写失败不改变数据并返回failed供重试', async () => {
    const storage = fakeStorage()
    const repository = createMessageRepository({ storage, now: () => 100 })
    const before = await repository.listMessages('trade-wzry')
    storage.fail = true
    const result = await repository.sendText('trade-wzry', '失败消息', 'fail-1')
    expect(result).toMatchObject({ ok: false, message: { id: 'fail-1', delivery: 'failed' } })
    expect(await repository.listMessages('trade-wzry')).toEqual(before)
  })

  it('确认换绑与验号不符互斥且只推进一次', async () => {
    const repository = createMessageRepository({ storage: fakeStorage(), now: () => 900 })
    expect(await repository.advanceBinding('trade-wzry')).toBe(true)
    expect(await repository.advanceBinding('trade-wzry')).toBe(false)
    expect(await repository.reportMismatch('trade-wzry')).toBe(false)
    expect((await repository.get('trade-wzry'))?.tradeState).toBe('confirmed')
    expect((await repository.listMessages('trade-wzry')).filter((item) => item.id === 'system-confirm-trade-wzry')).toHaveLength(1)
  })

  it('只允许按会话绑定的订单同步履约摘要', async () => {
    const repository = createMessageRepository({ storage: fakeStorage(), now: () => 12345 })
    expect(await repository.syncWorkflow({ conversationId: 'trade-wzry-od03', orderId: 'OD20260821000000001', phase: 'completed', role: 'buyer' })).toBe(false)
    expect((await repository.get('trade-wzry-od03'))?.workflowPhase).toBe('release')
    expect(await repository.syncWorkflow({ conversationId: 'trade-wzry-od03', orderId: 'OD20260821000000003', phase: 'completed', role: 'buyer' })).toBe(true)
    expect(await repository.get('trade-wzry-od03')).toMatchObject({ workflowOrderId: 'OD20260821000000003', workflowPhase: 'completed', stage: 'closed', progressLabel: '交易完成' })
  })

  it('新会话的 id 和订单绑定均不得冲突', async () => {
    const repository = createMessageRepository({ storage: fakeStorage(), now: () => 12345 })
    const base = (await repository.get('trade-wzry'))!
    expect(await repository.ensureConversation({ ...base, orderId: 'OD-other' })).toBe(false)
    expect(await repository.ensureConversation({ ...base, id: 'trade-other' })).toBe(false)
  })

  it('导航可在进入消息页之前同步取快照，未变更时保持引用稳定', async () => {
    const repository = createMessageRepository({ storage: fakeStorage(), now: () => 12345 })
    const initial = repository.getSnapshot()
    expect(repository.getSnapshot()).toBe(initial)
    const listener = vi.fn(() => repository.getSnapshot())
    const unsubscribe = repository.subscribe(listener)
    await repository.markRead('trade-hpjy')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(repository.getSnapshot()).not.toBe(initial)
    expect(repository.getSnapshot()).toBe(repository.getSnapshot())
    unsubscribe()
    await repository.markAllRead()
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('单条通知已读可持久化，通知全部已读不会清空交易会话', async () => {
    const storage = fakeStorage()
    const repository = createMessageRepository({ storage })
    const listener = vi.fn(); repository.subscribe(listener)
    expect(await repository.markNotificationRead('after-1')).toBe(true)
    expect(listener).toHaveBeenCalledTimes(1)
    expect((await repository.summary()).unreadCount).toBe(16)
    expect(createMessageRepository({ storage }).getSnapshot().notifications?.find(item => item.id === 'after-1')?.unread).toBe(false)
    expect(await repository.markNotificationRead('missing')).toBe(false)
    expect(await repository.markAllRead('notifications')).toBe(true)
    expect(repository.getSnapshot().notifications?.some(item => item.unread)).toBe(false)
    expect((await repository.summary()).unreadCount).toBe(13)
    expect((await repository.get('trade-hpjy'))?.unreadCount).toBe(2)
    await repository.sendText('trade-hpjy', '测试')
    expect(repository.getSnapshot().notifications?.some(item => item.unread)).toBe(false)
  })

  it('迁移旧通知不重复计数、不恢复已清零的通知或持久空数据', async () => {
    for (const unread of [0, 1]) {
      const seed = createMessageSeed(12345)
      delete seed.notifications
      seed.conversations = seed.conversations.map(item => item.id === 'system-notice' ? { ...item, unreadCount: unread } : item)
      const storage = fakeStorage({ [MESSAGES_STORAGE_KEY]: JSON.stringify(seed) })
      const repository = createMessageRepository({ storage })
      expect((await repository.summary()).unreadCount).toBe(13 + unread)
      expect(repository.getSnapshot().notifications?.filter(item => item.unread)).toHaveLength(unread)
      await repository.markRead('system-notice')
      expect(repository.getSnapshot().notifications?.filter(item => item.unread)).toHaveLength(unread)
    }
    const empty = createMessageRepository({ storage: fakeStorage({ [MESSAGES_STORAGE_KEY]: JSON.stringify({ conversations: [], messages: [] }) }) })
    expect(empty.getSnapshot()).toEqual({ conversations: [], messages: [], notifications: [] })
  })

  it('存储故障保留上次可信计数，失败写入不发出已读通知', async () => {
    const storage = fakeStorage()
    const repository = createMessageRepository({ storage })
    const initial = repository.getSnapshot()
    const listener = vi.fn(); repository.subscribe(listener)
    storage.fail = true
    expect(await repository.markNotificationRead('after-1')).toBe(false)
    expect(repository.getSnapshot()).toBe(initial)
    expect(listener).not.toHaveBeenCalled()
    storage.getItem = () => { throw new Error('storage unavailable') }
    expect(repository.getSnapshot()).toBe(initial)
  })

  it('同存储的多个订阅者跨实例同步通知已读', async () => {
    const storage = fakeStorage()
    const events = new EventTarget()
    const one = createMessageRepository({ storage, eventTarget: events })
    const two = createMessageRepository({ storage, eventTarget: events })
    two.getSnapshot()
    const listener = vi.fn(); two.subscribe(listener)
    await one.markNotificationRead('after-1')
    expect(listener).toHaveBeenCalledTimes(1)
    expect((await two.summary()).unreadCount).toBe(16)
    await one.markAllRead()
    expect((await two.summary()).unreadCount).toBe(0)
    one.dispose(); two.dispose()
  })
})
