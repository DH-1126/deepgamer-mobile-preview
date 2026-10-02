import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RestoredSeller } from '../linked/restoredSellerApi'
const state = vi.hoisted(() => ({ status: 'ready', connection: { actor: { managementId: 'synthetic-profile-owner', displayName: '绑定的合成卖家', sellerRef: 'synthetic-seller', recyclerId: null }, runtime: { runtimeId: 'restoration-0123456789abcdef' } }, transport: {}, error: null, reconnect: () => {} }))
const sellerState = vi.hoisted(() => ({ seller: null as RestoredSeller | null, loading: false, error: '审核状态读取失败' as string | null, refresh: async () => {} }))
const messageState = vi.hoisted(() => ({ conversations: [], unreadCount: 7, loading: false, error: null as string | null, refresh: async () => {} }))
vi.mock('../runtime/dataMode', () => ({ isLinkedDataMode: false, isRestoredLinkedMode: true, getRuntimeStorage: () => ({ getItem: () => null, setItem: () => {} }) }))
vi.mock('../linked/RestoredClientProvider', () => ({ useRestoredClient: () => state }))
vi.mock('../linked/useRestoredSeller', () => ({ useRestoredSeller: () => sellerState }))
vi.mock('../linked/useRestoredMessages', () => ({ useRestoredMessages: () => messageState }))
import { ProfilePage } from './ProfilePage'
import { AuthPromptProvider } from '../components/AuthAccess'
describe('restored profile identity and unavailable resources', () => {
  it('opens real purchase, orders, consultation, and recycling messages without prototype data', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/profile"><AuthPromptProvider><ProfilePage /></AuthPromptProvider></StaticRouter>)
    expect(html).toContain('href="/recycle"')
    expect(html).toContain('href="/message?tab=recycle"')
    expect(html).toContain('href="/buy"')
    expect(html).toContain('购买账号')
    expect(html).toContain('回收单可在咨询会话内报价、确认与支付')
    expect(html).toContain('href="/orders"')
    expect(html).toContain('我的买卖订单')
  })
  beforeEach(() => { sellerState.seller = null; sellerState.error = '审核状态读取失败'; messageState.error = null })
  it('renders the server member unread count and hides an expired count when refresh fails', () => {
    const render = () => renderToStaticMarkup(<StaticRouter location="/profile"><AuthPromptProvider><ProfilePage /></AuthPromptProvider></StaticRouter>)
    expect(render()).toContain('dg-bottom-nav__badge')
    expect(render()).toContain('7')
    messageState.error = '消息刷新失败'
    expect(render()).toContain('消息刷新失败')
    expect(render()).not.toContain('dg-bottom-nav__badge')
  })
  it('shows bound actor and failed seller read without prototype balances or fake seller completion', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/profile?scenario=complete"><AuthPromptProvider><ProfilePage /></AuthPromptProvider></StaticRouter>)
    expect(html).toContain('绑定的合成卖家')
    expect(html).toContain('synthetic-profile-owner')
    expect(html).toContain('审核状态读取失败')
    expect(html).toContain('暂未接入')
    expect(html).not.toContain('切换卖家状态预览')
    expect(html).not.toContain('已开通')
    expect(html).not.toContain('href="/publish"')
  })
  it('shows explicit capability restriction even when the application and signature succeeded', () => {
    sellerState.error = null
    sellerState.seller = { id: 'synthetic-seller', sellerRef: null, displayName: '绑定的合成卖家', status: 'APPROVED', contractStatus: 'SIGNED', rowVersion: 3, application: null, applicationId: 'synthetic-application', reviewReason: null, submittedAt: null, reviewedAt: null, provenance: 'LOCAL_DEMO', signature: null, canPublish: false }
    const html = renderToStaticMarkup(<StaticRouter location="/profile"><AuthPromptProvider><ProfilePage /></AuthPromptProvider></StaticRouter>)
    expect(html).toContain('卖家能力暂不可用')
    expect(html).toContain('服务端未开放')
    expect(html).not.toContain('履约订单与结算收入')
    expect(html).not.toContain('href="/publish"')
  })
  it('retains the existing header row and seller-card layout wrappers', () => {
    sellerState.error = null
    sellerState.seller = { id: 'synthetic-seller', sellerRef: null, displayName: '绑定的合成卖家', status: 'APPROVED', contractStatus: 'SIGNED', rowVersion: 3, application: null, applicationId: 'synthetic-application', reviewReason: null, submittedAt: null, reviewedAt: null, provenance: 'LOCAL_DEMO', signature: null, canPublish: true }
    const html = renderToStaticMarkup(<StaticRouter location="/profile"><AuthPromptProvider><ProfilePage /></AuthPromptProvider></StaticRouter>)
    expect(html).toContain('profile-v2-status')
    expect(html).toMatch(/<a class="profile-v2-seller-card-main"[^>]*>[\s\S]*<b>查看卖家中心<\/b><\/a>/)
  })
})
