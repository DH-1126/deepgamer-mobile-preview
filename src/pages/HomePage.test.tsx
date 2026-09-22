import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ authenticated: false, search: '', linked: false }))

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/', search: state.search, hash: '' }),
}))
vi.mock('../components/AuthAccess', () => ({
  useAuthStatus: () => state.authenticated,
  useAuthPrompt: () => ({ requireAuth: vi.fn() }),
}))
vi.mock('../components/BottomNav', () => ({ BottomNav: () => null }))
vi.mock('../linked/linkedData', () => ({ useLinkedState: () => null, toCatalogGame: vi.fn() }))
vi.mock('../runtime/dataMode', () => ({ get isLinkedDataMode() { return state.linked } }))

import { HomePage } from './HomePage'

describe('homepage entry states', () => {
  beforeEach(() => { state.authenticated = false; state.search = ''; state.linked = false })

  it('hides the entire recent-history section for guests', () => {
    const html = renderToStaticMarkup(<HomePage />)
    expect(html).not.toContain('最近看过')
    expect(html).not.toContain('全部足迹')
    expect(html).not.toContain('home-v2-recent')
    expect(html).toContain('热门游戏')
    expect(html).toContain('guest-login-bar-home')
  })

  it('uses real status-bar controls for the current home state', () => {
    let html = renderToStaticMarkup(<HomePage />)
    expect(html).not.toContain('data-design-prompt-trigger')
    expect(html).toContain('data-page-spec-trigger="true"')
    expect(html).toContain('data-review-node-id="7144:1039"')

    state.authenticated = true
    html = renderToStaticMarkup(<HomePage />)
    expect(html).toContain('data-review-node-id="7146:1316"')

    state.search = '?footprints=empty'
    html = renderToStaticMarkup(<HomePage />)
    expect(html).toContain('data-review-node-id="7146:1627"')
  })

  it('always uses the dark floating prompt for guests, including empty history', () => {
    for (const search of ['', '?footprints=empty']) {
      state.search = search
      const html = renderToStaticMarkup(<HomePage />)
      expect(html).toContain('class="home-draft3-login-bar guest-login-bar-home home-draft3-login-bar--dark"')
      expect(html).not.toContain('最近看过')
    }
  })

  it('shows recent history only for signed-in users with available demo records', () => {
    state.authenticated = true
    const html = renderToStaticMarkup(<HomePage />)
    expect(html).toContain('最近看过')
    expect(html).toContain('全部足迹')
    expect(html).not.toContain('guest-login-bar-home')
    state.search = '?footprints=empty'
    expect(renderToStaticMarkup(<HomePage />)).not.toContain('最近看过')
    state.search = ''
    state.linked = true
    expect(renderToStaticMarkup(<HomePage />)).not.toContain('最近看过')
  })

  it('keeps the download banner hidden until the brand is clicked', () => {
    for (const authenticated of [false, true]) {
      state.authenticated = authenticated
      const html = renderToStaticMarkup(<HomePage />)
      expect(html).toContain('aria-expanded="false" aria-controls="home-app-download"')
      expect(html).not.toContain('立即下载')
      expect(html).not.toContain('深度玩家APP体验更好')
    }
  })

  it('keeps recent-game browse counts without price-drop badges or a trailing separator', () => {
    state.authenticated = true
    const html = renderToStaticMarkup(<HomePage />)
    expect(html).toContain('<strong>王者荣耀</strong><small>看过 12 个</small>')
    expect(html).toContain('<strong>和平精英</strong><small>看过 3 个</small>')
    expect(html).not.toContain('个降价')
    expect(html).not.toContain('看过 12 个 ·')
  })

  it('exposes one whole-card feedback trigger and three service dialog triggers', () => {
    const html = renderToStaticMarkup(<HomePage />)
    expect(html).toContain('aria-label="吐槽广场，去吐槽"')
    expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(4)
    expect(html).toContain('吐槽服务')
    expect(html).toContain('产品建议')
    expect(html).toContain('社区共建')
    expect(html).not.toContain('role="dialog"')
  })
})
