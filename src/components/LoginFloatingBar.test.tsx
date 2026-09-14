import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  authenticated: false,
  location: { pathname: '/goods/1', search: '?from=search', hash: '#assets' },
  navigate: vi.fn(),
}))
vi.mock('./AuthAccess', () => ({ useAuthStatus: () => state.authenticated }))
vi.mock('react-router-dom', async () => ({
  ...await vi.importActual<typeof import('react-router-dom')>('react-router-dom'),
  useLocation: () => state.location,
  useNavigate: () => state.navigate,
}))
import { GuestLoginFloatingBar, LoginFloatingBar } from './LoginFloatingBar'

beforeEach(() => { state.authenticated = false; state.navigate.mockReset() })

describe('shared guest login floating bar', () => {
  it('reuses the homepage markup and fixed-position classes exactly', () => {
    expect(renderToStaticMarkup(<GuestLoginFloatingBar />)).toBe(renderToStaticMarkup(<LoginFloatingBar onLogin={() => undefined} />))
  })

  it('supports a flow placement for component-library previews without changing the callback contract', () => {
    const html = renderToStaticMarkup(<LoginFloatingBar placement="flow" onLogin={() => undefined} />)
    expect(html).toContain('home-draft3-login-bar--flow')
  })

  it('hides the entire prompt for an authenticated user', () => {
    state.authenticated = true
    expect(renderToStaticMarkup(<GuestLoginFloatingBar />)).toBe('')
  })

  it('carries a submitted search keyword even when the current URL has no query', () => {
    state.location = { pathname: '/search', search: '', hash: '' }
    GuestLoginFloatingBar({ returnTo: '/search?q=王者' })?.props.onLogin()
    const url = new URL(state.navigate.mock.calls[0][0], 'http://localhost')
    expect(url.searchParams.get('returnTo')).toBe('/search?q=王者')
    expect(url.searchParams.get('closeTo')).toBe('/search?q=王者')
  })

  it.each([
    { pathname: '/goods/1', search: '?from=search', hash: '#assets' },
    { pathname: '/search', search: '?q=王者&gameCode=wzry', hash: '' },
  ])('returns to the same route after login or closing login: $pathname', (location) => {
    state.location = location
    GuestLoginFloatingBar()?.props.onLogin()
    const [target] = state.navigate.mock.calls[0]
    const url = new URL(target, 'http://localhost')
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('returnTo')).toBe(location.pathname + location.search + location.hash)
    expect(url.searchParams.get('closeTo')).toBe(location.pathname + location.search + location.hash)
  })
})
