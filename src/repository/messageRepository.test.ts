import { describe, expect, it, vi } from 'vitest'
import { MESSAGES_STORAGE_KEY, SUPPORT_CONVERSATION_ID } from '../data/messageFixtures'
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
  it('仅在key缺失时seed，持久空不重灌', async () => {
    const storage = fakeStorage()
    const repository = createMessageRepository({ storage, now: () => 2_000_000_000_000 })
    expect(await repository.list()).toHaveLength(7)
    const empty = fakeStorage({ [MESSAGES_STORAGE_KEY]: JSON.stringify({ conversations: [], messages: [] }) })
    expect(await createMessageRepository({ storage: empty }).list()).toEqual([])
  })

  it('内置平台客服会话可直接进入并发送消息', async () => {
    const repository = createMessageRepository({ storage: fakeStorage(), now: () => 2_000_000_000_000 })
    expect(await repository.get(SUPPORT_CONVERSATION_ID)).toMatchObject({ id: SUPPORT_CONVERSATION_ID, kind: 'support', title: '萌萌' })
    expect((await repository.listMessages(SUPPORT_CONVERSATION_ID))[0]).toMatchObject({ sender: 'support', senderName: '萌萌 · 平台客服' })
    expect((await repository.sendText(SUPPORT_CONVERSATION_ID, '我想咨询交易流程')).ok).toBe(true)
  })

  it('打开会话标已读并同步badge，全部已读清零', async () => {
    const repository = createMessageRepository({ storage: fakeStorage(), now: () => 2_000_000_000_000 })
    expect((await repository.summary()).unreadCount).toBe(3)
    expect(await repository.markRead('trade-hpjy')).toBe(true)
    expect((await repository.summary()).unreadCount).toBe(1)
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
})
