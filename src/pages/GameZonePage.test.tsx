import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ authenticated: false }))
vi.mock('../components/AuthAccess', () => ({
  useAuthStatus: () => state.authenticated,
  useAuthPrompt: () => ({ requireAuth: vi.fn(() => state.authenticated) }),
}))

import { GameZonePage } from './GameZonePage'

describe('catalog support floating button', () => {
  it.each(['wzry', 'hpjy'])('only shows customer support after login for %s', gameCode => {
    const render = () => renderToStaticMarkup(<StaticRouter location={`/game?gameCode=${gameCode}`}><GameZonePage /></StaticRouter>)
    state.authenticated = false
    const guest = render()
    expect(guest).not.toContain('class="catalog-d3-support"')
    expect(guest).not.toContain('aria-label="联系客服"')
    expect(guest).toContain('aria-label="登录引导"')
    expect(guest).toContain('data-ui="BottomNav"')
    state.authenticated = true
    const authenticated = render()
    expect(authenticated).toContain('class="catalog-d3-support"')
    expect(authenticated).toContain('aria-label="联系客服"')
    expect(authenticated).not.toContain('aria-label="登录引导"')
    state.authenticated = false
    expect(render()).not.toContain('class="catalog-d3-support"')
  })

  it('uses shared filter triggers and removes the find-skin entry', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/game?gameCode=wzry"><GameZonePage /></StaticRouter>)
    expect(html.match(/data-ui="FilterTrigger"/g)).toHaveLength(3)
    expect(html).toContain('>200+皮肤</button>')
    expect(html).not.toContain('找皮肤')
    expect(html).not.toContain('catalog-d3-find-skin')
  })
})
