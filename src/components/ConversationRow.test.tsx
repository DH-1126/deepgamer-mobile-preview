import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMessageSeed } from '../data/messageFixtures'
import { createOrderSeed } from '../data/orderFixtures'
import { ConversationRow } from './ConversationRow'

afterEach(() => vi.restoreAllMocks())

describe('ConversationRow', () => {
  const now = new Date(2026, 8, 14, 12).getTime()
  const conversation = createMessageSeed(now).conversations.find(item => item.kind === 'trade_group')!

  it('keeps the platform support treatment', () => {
    const support = createMessageSeed(now).conversations.find(item => item.kind === 'support')!
    const html = renderToStaticMarkup(<ConversationRow item={support} onOpen={vi.fn()} />)

    expect(html).toContain('kind-support')
    expect(html).toContain('game-support')
    expect(html).toContain('message-support-badge')
    expect(html).toContain('dg-status-badge--brand')
    expect(html).toContain('平台客服')
  })

  it.each([
    ['pending', '待付款', 'warning'], ['paid', '资料同步', 'info'], ['verifying', '验号', 'info'],
    ['binding', '换绑', 'info'], ['bind_success', '确认放款', 'info'], ['completed', '完成', 'success'], ['closed', '关闭', 'neutral'],
  ] as const)('maps order status %s to the shared %s tone', (status, label, tone) => {
    const order = { ...createOrderSeed(now)[0], status }
    const html = renderToStaticMarkup(<ConversationRow item={conversation} order={order} onOpen={vi.fn()} />)

    expect(html).toContain(`trade-state-${status === 'paid' ? 'materials' : status === 'verifying' ? 'inspection' : status === 'bind_success' ? 'release' : status}`)
    expect(html).toContain(`dg-status-badge--${tone} message-trade-badge`)
    expect(html).toContain(`>${label}</span>`)
  })

  it('hides a zero unread count', () => {
    const html = renderToStaticMarkup(<ConversationRow item={{ ...conversation, unreadCount: 0 }} onOpen={vi.fn()} />)

    expect(html).not.toContain('message-d3-meta"><i>')
    expect(html).not.toContain('条未读')
  })

  it.each([
    [new Date(2026, 8, 14, 9, 5).getTime(), '09:05'],
    [new Date(2026, 8, 13, 10).getTime(), '昨天'],
    [new Date(2026, 8, 12, 10).getTime(), '09-12'],
    [new Date(2025, 8, 12, 10).getTime(), '2025'],
  ])('formats %s as %s', (updatedAt, label) => {
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const html = renderToStaticMarkup(<ConversationRow item={{ ...conversation, updatedAt, elapsedLabel: '旧版时间' }} onOpen={vi.fn()} />)

    expect(html).toContain(`<time>${label}</time>`)
    expect(html).not.toContain('旧版时间')
  })

  it.each([false, true])('only renders the type badge when requested: %s', showTypeBadge => {
    const html = renderToStaticMarkup(<ConversationRow item={conversation} showTypeBadge={showTypeBadge} onOpen={vi.fn()} />)

    expect(/<em data-kind="(?:trade|recycle)">(交易|回收)<\/em>/.test(html)).toBe(showTypeBadge)
  })
})
