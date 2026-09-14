import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({ authenticated: false }))
vi.mock('../components/AuthAccess', () => ({ useAuthStatus: () => auth.authenticated, useAuthPrompt: () => ({ requireAuth: vi.fn() }) }))
import { ProfilePage } from './ProfilePage'

describe('profile component library entrance', () => {
  it.each([false, true])('offers the same entry when authenticated=%s', authenticated => {
    auth.authenticated = authenticated
    const html = renderToStaticMarkup(<StaticRouter location="/profile"><ProfilePage /></StaticRouter>)
    expect(html).toContain('class="profile-v2-library-entry"')
    expect(html).toContain('href="/component-library"')
    expect(html).toContain('aria-label="查看组件库与规范"')
    expect(html).toContain('data-ui="BottomNav"')
    expect(html).toContain('dg-bottom-nav--flow')
    expect(html).not.toContain('profile-v2-nav')
    if (authenticated) expect(html).toContain('data-ui="Cell"')
    else expect(html).toContain('游客')
  })
})

describe('profile seller entry', () => {
  const renderProfile = (location: string) => {
    auth.authenticated = true
    return renderToStaticMarkup(<StaticRouter location={location}><ProfilePage /></StaticRouter>)
  }

  it('renames balance to wallet and makes seller status switching a separate button', () => {
    const html = renderProfile('/profile')
    expect(html).toContain('>钱包<')
    expect(html).not.toContain('余额（元）')
    expect(html).toContain('aria-label="切换卖家状态预览，当前未签约"')
    expect(html).toContain('href="/seller/center?scenario=buyer"')
    expect(html).not.toMatch(/<a[^>]*profile-v2-seller-card[^>]*>[\s\S]*?<button/)
  })

  it('keeps ID copying but removes real-name status from the top identity area', () => {
    const html = renderProfile('/profile')
    const header = html.match(/<header class="profile-v2-header"[\s\S]*?<\/header>/)?.[0] ?? ''
    expect(header).toContain('复制管理ID')
    expect(header).not.toContain('已实名')
    expect(header).not.toContain('已认证')
    expect(html).toContain('href="/realname"')
    expect(html).toContain('data-ui="ProfileFeatureList"')
  })

  it.each([
    ['signing', '待签署', '/seller/center?scenario=approved'],
    ['review', '审核中', '/seller/center?scenario=review'],
    ['rejected', '未通过', '/seller/center?scenario=rejected'],
    ['seller', '已开通', '/seller/center?scenario=complete'],
  ])('links sellerState=%s to the matching existing flow', (state, label, route) => {
    const html = renderProfile(`/profile?from=message&sellerState=${state}`)
    expect(html).toContain(label)
    expect(html).toContain(`href="${route.replace('&', '&amp;')}"`)
  })
})
