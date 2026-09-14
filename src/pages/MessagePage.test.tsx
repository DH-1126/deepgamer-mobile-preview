import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../components/AuthAccess', () => ({ useAuthStatus: () => true, useAuthPrompt: () => ({ requireAuth: vi.fn(() => true) }) }))
import { ConversationRow, MessagePage } from './MessagePage'
import { NotificationCenterPage, NotificationSettingsPage } from './NotificationPages'
import { BottomNav } from '../components/BottomNav'
import { createMessageSeed, MESSAGES_STORAGE_KEY } from '../data/messageFixtures'
import { getRuntimeStorage } from '../runtime/dataMode'
import { createRecycleConsultationSeed, RECYCLE_STORAGE_KEY } from '../data/recycleFixtures'
import { recyclerFixtures } from '../data/sellFixtures'
import { createOrderSeed } from '../data/orderFixtures'

afterEach(() => vi.restoreAllMocks())

describe('transaction status badges', () => {
  it.each([false, true])('only shows trade avatar type badges in the combined list: %s', showTypeBadge => {
    const item = createMessageSeed(Date.now()).conversations.find(item => item.kind === 'trade_group')!
    const html = renderToStaticMarkup(<ConversationRow item={item} showTypeBadge={showTypeBadge} onOpen={vi.fn()} />)
    expect(/<em data-kind="(?:trade|recycle)">(交易|回收)<\/em>/.test(html)).toBe(showTypeBadge)
  })
  it.each([
    ['pending', '待付款', 'warning'], ['paid', '资料同步', 'info'], ['verifying', '验号', 'info'],
    ['binding', '换绑', 'info'], ['bind_success', '确认放款', 'info'], ['completed', '完成', 'success'], ['closed', '关闭', 'neutral'],
  ] as const)('renders the shared %s badge without reminder-specific styles', (status, label, tone) => {
    const now = Date.now()
    const conversation = { ...createMessageSeed(now).conversations[0], progressLabel: '换绑超时' }
    const order = { ...createOrderSeed(now)[0], status }
    const html = renderToStaticMarkup(<ConversationRow item={conversation} order={order} onOpen={vi.fn()} />)
    expect(html).toContain('data-ui="StatusBadge"')
    expect(html).toContain(`dg-status-badge--${tone} message-trade-badge`)
    expect(html).toContain(`>${label}</span>`)
    expect(html).not.toContain('换绑超时')
    expect(html).not.toContain('message-d3-badge danger')
  })
})

describe('conversation row timestamps', () => {
  it.each(['trade_group', 'support'] as const)('uses timestamps rather than preset elapsed labels for %s', kind => {
    const now = new Date(2026, 8, 14, 12).getTime()
    vi.spyOn(Date, 'now').mockReturnValue(now)
    const base = createMessageSeed(now).conversations.find(item => item.kind === kind)!
    for (const [updatedAt, label] of [
      [new Date(2026, 8, 14, 9, 5).getTime(), '09:05'],
      [new Date(2026, 8, 13, 10).getTime(), '昨天'],
      [new Date(2026, 8, 12, 10).getTime(), '09-12'],
      [new Date(2025, 8, 12, 10).getTime(), '2025'],
    ] as const) {
      const html = renderToStaticMarkup(<ConversationRow item={{ ...base, updatedAt, elapsedLabel: '旧版时间' }} onOpen={vi.fn()} />)
      expect(html).toContain(`<time>${label}</time>`)
      expect(html).not.toContain('旧版时间')
    }
  })
})

describe('message bottom navigation', () => {
  beforeEach(() => {
    getRuntimeStorage().setItem(MESSAGES_STORAGE_KEY, JSON.stringify(createMessageSeed(2_000_000_000_000)))
    getRuntimeStorage().setItem(RECYCLE_STORAGE_KEY, JSON.stringify({ activeOrderId: null, orders: [] }))
  })
  it.each(['/message', '/message?tab=groups', '/message?tab=recycle'])('separates the shared support card above normal messages on %s', route => {
    getRuntimeStorage().setItem(RECYCLE_STORAGE_KEY, JSON.stringify(createRecycleConsultationSeed(2_000_000_000_000, recyclerFixtures)))
    const html = renderToStaticMarkup(<StaticRouter location={route}><MessagePage /></StaticRouter>)
    const list = html.match(/<section class="message-v2-scroll"[\s\S]*?<\/section>/)?.[0] ?? ''
    expect(list).toContain('aria-label="会话列表"><div class="message-support-section"><button')
    expect(list.match(/kind-support/g)).toHaveLength(1)
    expect(list).toContain('萌萌')
    expect(list).toContain('平台客服')
    expect(list.match(/dg-status-badge--brand message-support-badge/g)).toHaveLength(1)
    expect(list).toContain('dg-status-badge__icon')
    if (route.endsWith('recycle')) {
      expect(list.indexOf('message-support-section')).toBeLessThan(list.indexOf('message-conversation-list'))
    }
  })
  it.each([
    ['/message', MessagePage], ['/notifications', NotificationCenterPage], ['/notifications/settings', NotificationSettingsPage],
  ] as const)('shares the homepage navigation and global unread state on %s', (route, Page) => {
    const render = (element: React.ReactNode) => renderToStaticMarkup(<StaticRouter location={route}>{element}</StaticRouter>)
    const actual = render(<Page />).match(/<nav data-ui="BottomNav"[\s\S]*?<\/nav>/)?.[0] ?? ''
    expect(actual).toBe(render(<BottomNav placement="flow" showGuestPrompt={false} />))
    expect(actual).toContain('data-ui="BottomNav"')
    expect(actual).toContain('aria-label="17项"')
    expect(actual.match(/aria-current="page"/g)).toHaveLength(1)
    expect(actual.match(/<a [^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/)?.[0]).toContain('消息')
  })

  it('renders all eight consultation contacts in the recycle tab with a status and unread badge each', () => {
    getRuntimeStorage().setItem(RECYCLE_STORAGE_KEY, JSON.stringify(createRecycleConsultationSeed(2_000_000_000_000, recyclerFixtures)))
    const html = renderToStaticMarkup(<StaticRouter location="/message?tab=recycle"><MessagePage /></StaticRouter>)
    const list = html.match(/<section class="message-v2-scroll"[\s\S]*?<\/section>/)?.[0] ?? ''
    for (const prefix of ['买家', '回收商']) for (let n = 1; n <= 4; n++) expect(list).toContain(`${prefix}${n}`)
    expect(list.match(/message-recycle-row/g)).toHaveLength(8)
    expect(list.match(/class="message-conversation message-d3-row message-recycle-row"[^>]*aria-label="([^"]*)"/)?.[1]).toMatch(/^买家1，/)
    expect(list.match(/data-ui="CountBadge"/g)).toHaveLength(8)
    expect(list).toContain('沟通中')
    expect(list).toContain('已下单')
    expect(list).not.toMatch(/<em[^>]*>(交易|回收)<\/em>/)
    expect(html).toContain('>回收群</button>')
    expect(html).not.toContain('新咨询')
    expect(html).not.toContain('recycle-v2-card')
  })
})
