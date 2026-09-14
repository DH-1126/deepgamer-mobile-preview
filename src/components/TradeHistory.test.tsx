import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createArchivedTradeSeed } from '../data/archivedTradeFixtures'
import { createMessageSeed } from '../data/messageFixtures'
import { createOrderSeed } from '../data/orderFixtures'
import { createMessageRepository } from '../repository/messageRepository'
import { getTradeConversationStatus } from './tradeConversationStatus'
import { filterConversations, groupTradeConversations } from './messageModel'
import { GroupSections } from '../pages/MessagePage'
import { TradeChatPage } from '../pages/TradeChatPage'
import { TradeHistory } from './TradeHistory'

const now = new Date(2026, 8, 14, 12).getTime()
const seed = createArchivedTradeSeed(now)

describe('archived full transaction history', () => {
  it('places the closed example first in transaction groups without changing other groups or all-list filtering', () => {
    const groups = groupTradeConversations(filterConversations(createMessageSeed(now).conversations, 'groups'))
    const html = renderToStaticMarkup(<GroupSections groups={groups} ordersById={new Map(createOrderSeed(now).map(order => [order.id, order]))} onOpen={vi.fn()} />)
    expect(html.indexOf('WZ-HISTORY-001')).toBeLessThan(html.indexOf('WZ0001'))
    expect(html).toContain('trade-state-closed')
    expect(html).toContain('>已关闭</span>')
    expect(getTradeConversationStatus(seed.conversation, seed.order).status).toBe('closed')
    expect(seed.order.status).toBe('completed')
    expect(filterConversations(createMessageSeed(now).conversations, 'all').some(item => item.historyPreview)).toBe(false)
    expect(filterConversations(createMessageSeed(now).conversations, 'groups', 'WZ-HISTORY-001').map(item => item.id)).toEqual([seed.conversation.id])
  })

  it('covers the original card variants in workflow order and closes seven days after completion', () => {
    const keys = seed.messages.flatMap(message => message.tradeCard ? [message.tradeCard.key] : [])
    expect(keys).toEqual(['product', 'materials-empty', 'materials-waiting', 'materials-submitted', 'credentials', 'inspection-waiting', 'inspection', 'issue', 'issue-resolved', 'inspection-terminal', 'binding-buyer', 'phone', 'binding-seller', 'delivery', 'release', 'completed', 'closed'])
    const times = seed.messages.map(message => message.createdAt)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(times.every(time => time >= seed.order.createdAt && time <= now)).toBe(true)
    expect(seed.conversation.updatedAt - seed.order.updatedAt).toBe(7 * 24 * 60 * 60_000)
    const html = renderToStaticMarkup(<TradeHistory conversation={seed.conversation} messages={seed.messages} />)
    for (const text of ['当前环节已更新', '资料已提交', '禁止提供手机号', 'QQ 账号风控须知', '@买家', '@卖家', '异常已处理', '确认放款']) expect(html).toContain(text)
    expect(html).toContain('trade-history-strip updated')
    expect(html).toContain('trade-history-strip submitted')
    expect(html).toContain('trade-d3-task critical')
    expect(html).toContain('trade-d3-message self')
    for (const tone of ['default', 'primary', 'disabled']) expect(html).toContain(`trade-history-action-${tone}`)
    for (const element of html.match(/<(?:button|input)\b[^>]*>/g) ?? []) expect(element).toContain('disabled=""')
    expect(html).toContain('***')
    expect(html).not.toContain('DemoPass')
    expect(html).not.toContain('187****')
  })

  it('keeps the closed composer and history read-only even with phase-preview URL parameters', async () => {
    const html = renderToStaticMarkup(<StaticRouter location={`/im/${seed.conversation.id}?scenario=preview&phase=materials&role=seller`}><TradeChatPage conversation={seed.conversation} /></StaticRouter>)
    expect(html).toContain('会话已关闭 · 交易已完成')
    expect(html).toMatch(/<input[^>]*disabled=""[^>]*placeholder="会话已关闭"/)
    expect(html).not.toContain('资料同步 · 请填写账号资料')
    const values = new Map<string, string>()
    const repository = createMessageRepository({ now: () => now, storage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value) }, removeItem: key => { values.delete(key) } } })
    const before = await repository.listMessages(seed.conversation.id)
    expect((await repository.sendText(seed.conversation.id, '不应发送')).ok).toBe(false)
    expect(await repository.syncWorkflow({ conversationId: seed.conversation.id, orderId: seed.order.id, phase: 'materials', role: 'seller' })).toBe(false)
    expect((await repository.get(seed.conversation.id))?.closed).toBe(true)
    expect(await repository.listMessages(seed.conversation.id)).toEqual(before)
  })
})
