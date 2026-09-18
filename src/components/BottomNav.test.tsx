import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ authenticated: false }))
vi.mock('./AuthAccess', () => ({
  useAuthStatus: () => state.authenticated,
  useAuthPrompt: () => ({ requireAuth: vi.fn() }),
}))

import { BottomNav, BottomNavView, getActiveNavKey } from './BottomNav'
import { LoginFloatingBar } from './LoginFloatingBar'
import { createMessageSeed, MESSAGES_STORAGE_KEY, SUPPORT_CONVERSATION_ID } from '../data/messageFixtures'
import { messageRepository } from '../repository/messageRepository'
import { getRuntimeStorage } from '../runtime/dataMode'
import { createOrderSeed, ORDERS_STORAGE_KEY } from '../data/orderFixtures'
import { afterSalesFixtures, AFTERSALES_STORAGE_KEY } from '../data/afterSalesFixtures'
import { orderRepository } from '../repository/orderRepository'
import { afterSaleRepository } from '../repository/afterSaleRepository'
import { createRecycleConsultationSeed, RECYCLE_STORAGE_KEY } from '../data/recycleFixtures'
import { recyclerFixtures } from '../data/sellFixtures'
import { recycleRepository } from '../repository/recycleRepository'

beforeEach(() => {
  state.authenticated = false
  getRuntimeStorage().setItem(MESSAGES_STORAGE_KEY, JSON.stringify(createMessageSeed(2_000_000_000_000)))
  getRuntimeStorage().setItem(ORDERS_STORAGE_KEY, '[]')
  getRuntimeStorage().setItem(AFTERSALES_STORAGE_KEY, '[]')
  getRuntimeStorage().setItem(RECYCLE_STORAGE_KEY, JSON.stringify({ activeOrderId: null, orders: [] }))
})

describe('shared catalog and homepage login prompt', () => {
  beforeEach(() => { state.authenticated = false })
  const render = (variant: 'home' | 'catalog', showGuestPrompt = true) => renderToStaticMarkup(
    <StaticRouter location="/game?gameCode=hpjy"><BottomNav variant={variant} gameCode="hpjy" gameName="和平精英" showGuestPrompt={showGuestPrompt} /></StaticRouter>,
  )

  it('uses exactly the same prompt markup as the homepage for either navigation variant', () => {
    const sharedPrompt = renderToStaticMarkup(<LoginFloatingBar onLogin={() => undefined} />)
    for (const variant of ['home', 'catalog'] as const) {
      const html = render(variant)
      expect(html.match(/<aside\b[\s\S]*?<\/aside>/g)).toEqual([sharedPrompt])
      expect(html).toContain('home-draft3-login-bar--dark')
      expect(html).toContain('人人都是深度玩家，登陆领取更多优惠')
      expect(html).not.toContain('快来登录吧，一起成为深度玩家！')
      expect(html).toContain('aria-label="主导航"')
    }
  })

  it('hides the prompt after login without hiding the current game navigation', () => {
    state.authenticated = true
    const html = render('catalog')
    expect(html).not.toContain('<aside')
    expect(html).toContain('和平精英')
    expect(html).toContain('/game?gameCode=hpjy')
  })

  it('respects explicit prompt suppression so the homepage cannot show it twice', () => {
    for (const variant of ['home', 'catalog'] as const) expect(render(variant, false)).not.toContain('<aside')
  })
})

describe('one homepage-style navigation for every tab', () => {
  it('renders an isolated preview from props without loading or changing business counts', () => {
    const before = getRuntimeStorage().getItem(MESSAGES_STORAGE_KEY)
    const html = renderToStaticMarkup(<StaticRouter location="/component-library"><BottomNavView activeKey="message" items={[{ key: 'message', label: '消息', href: '/message', icon: 'nav-message.svg', badgeCount: 128 }, { key: 'profile', label: '我的', href: '/profile', icon: 'nav-profile.svg', badgeCount: 3 }]} /></StaticRouter>)
    expect(html).toContain('dg-bottom-nav--flow')
    expect(html).toContain('aria-label="128项"')
    expect(html).toContain('aria-label="3项"')
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    expect(getRuntimeStorage().getItem(MESSAGES_STORAGE_KEY)).toBe(before)
  })
  it.each([
    ['/', 'home', '首页'], ['/game', 'catalog', '买号'], ['/game/select', 'catalog', '买号'],
    ['/sell', 'sell', '卖'], ['/message', 'message', '消息'], ['/notifications', 'message', '消息'],
    ['/notifications/settings', 'message', '消息'], ['/profile', 'profile', '我的'],
  ])('selects exactly the right item on %s', (path, key, label) => {
    expect(getActiveNavKey(path)).toBe(key)
    const html = renderToStaticMarkup(<StaticRouter location={path}><BottomNav placement="flow" showGuestPrompt={false} /></StaticRouter>)
    expect(html).toContain('data-ui="BottomNav"')
    expect(html.match(/<a /g)).toHaveLength(5)
    expect(html.match(/aria-current="page"/g)).toHaveLength(1)
    const selected = html.match(/<a [^>]*aria-current="page"[^>]*>[\s\S]*?<\/a>/)?.[0]
    expect(selected).toContain(label)
    expect(html.match(/dg-bottom-nav__icon"/g)).toHaveLength(4)
    expect(html).toContain('assets/home-v2/nav-buy.svg')
    expect(html).not.toContain('message-v2-nav')
    expect(html).not.toContain('profile-v2-nav')
  })

  it('does not mark similar but unrelated route prefixes as active', () => {
    for (const path of ['/games', '/messages', '/profile-settings']) expect(getActiveNavKey(path)).toBeUndefined()
  })

  it('retains message counts without replacing the active-page state', () => {
    state.authenticated = true
    const renderCount = (count: number) => {
      const store = createMessageSeed(2_000_000_000_000)
      store.notifications = []
      store.conversations = store.conversations.map(item => ({ ...item, unreadCount: item.id === SUPPORT_CONVERSATION_ID ? count : 0 }))
      getRuntimeStorage().setItem(MESSAGES_STORAGE_KEY, JSON.stringify(store))
      return renderToStaticMarkup(<StaticRouter location="/notifications"><BottomNav showGuestPrompt={false} /></StaticRouter>)
    }
    expect(renderCount(0)).not.toContain('data-ui="CountBadge"')
    expect(renderCount(3)).toContain('aria-label="3项"')
    expect(renderCount(120)).toContain('99+')
    expect(renderCount(120).match(/aria-current="page"/g)).toHaveLength(1)
  })

  const renderNav = (route: string) => renderToStaticMarkup(<StaticRouter location={route}><BottomNav showGuestPrompt={false} /></StaticRouter>)
  const routes = ['/', '/game?gameCode=hpjy', '/message', '/message?tab=groups', '/profile', '/notifications', '/notifications/settings']

  it('reads the same unread total on every route before the message page has mounted', () => {
    state.authenticated = true
    for (const route of routes) expect(renderNav(route)).toContain('aria-label="17项"')
  })

  it('reflects conversation and notification reads on every tab, then hides zero', async () => {
    state.authenticated = true
    await messageRepository.markRead('trade-hpjy')
    for (const route of routes) expect(renderNav(route)).toContain('aria-label="15项"')
    await messageRepository.markNotificationRead('after-1')
    for (const route of routes) expect(renderNav(route)).toContain('aria-label="14项"')
    await messageRepository.markAllRead()
    for (const route of routes) expect(renderNav(route)).not.toContain('data-ui="CountBadge"')
  })

  it('includes consultation unread counts on every tab and removes only the opened consultation count', () => {
    state.authenticated = true
    const seed = createRecycleConsultationSeed(2_000_000_000_000, recyclerFixtures)
    getRuntimeStorage().setItem(RECYCLE_STORAGE_KEY, JSON.stringify(seed))
    const total = seed.orders.reduce((sum, item) => sum + (item.unreadCount ?? 0), 0)
    expect(total).toBeGreaterThan(0)
    for (const route of routes) expect(renderNav(route)).toContain(`aria-label="${17 + total}项"`)
    expect(recycleRepository.markRead(seed.orders[0].id)).toBe(true)
    for (const route of routes) expect(renderNav(route)).toContain(`aria-label="${17 + total - seed.orders[0].unreadCount!}项"`)
    state.authenticated = false
    for (const route of routes) expect(renderNav(route)).not.toContain('data-ui="CountBadge"')
  })

  it('hides private counts when logged out and restores them only after login', () => {
    const snapshot = vi.spyOn(messageRepository, 'getSnapshot')
    for (const route of routes) expect(renderNav(route)).not.toContain('data-ui="CountBadge"')
    expect(snapshot).not.toHaveBeenCalled()
    state.authenticated = true
    expect(renderNav('/')).toContain('aria-label="17项"')
    state.authenticated = false
    expect(renderNav('/')).not.toContain('data-ui="CountBadge"')
    snapshot.mockRestore()
  })

  it('shows the sum of pending order entries on Profile across every tab, independently of messages', async () => {
    state.authenticated = true
    getRuntimeStorage().setItem(ORDERS_STORAGE_KEY, JSON.stringify(createOrderSeed(2_000_000_000_000)))
    getRuntimeStorage().setItem(AFTERSALES_STORAGE_KEY, JSON.stringify(afterSalesFixtures))
    const profileLink = (route: string) => renderNav(route).match(/<a [^>]*href="\/profile"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? ''
    for (const route of routes) {
      expect(profileLink(route)).toContain('aria-label="7项"')
      expect(renderNav(route)).toContain('aria-label="17项"')
    }
    orderRepository.cancel('OD20260821000000001')
    for (const route of routes) expect(profileLink(route)).toContain('aria-label="6项"')
    afterSaleRepository.restore([])
    orderRepository.restore([])
    expect(profileLink('/')).not.toContain('data-ui="CountBadge"')
    expect(renderNav('/')).toContain('aria-label="17项"')
  })
})
