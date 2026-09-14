import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ authenticated: false }))
vi.mock('../components/AuthAccess', () => ({ useAuthStatus: () => state.authenticated }))
import { LoginFloatingBar } from '../components/LoginFloatingBar'
import { SearchPage } from './SearchPage'

beforeEach(() => { state.authenticated = false })

describe('search guest login prompt', () => {
  it.each(['/search', '/search?q=王者'])('shows one shared prompt outside the scroll area at %s', (location) => {
    const html = renderToStaticMarkup(<StaticRouter location={location}><SearchPage /></StaticRouter>)
    const prompt = renderToStaticMarkup(<LoginFloatingBar onLogin={() => undefined} />)
    expect(html.match(/<aside\b[\s\S]*?<\/aside>/g)).toEqual([prompt])
    expect(html).toContain(`</div>${prompt}</main>`)
    expect(html).toContain('data-ui="SearchField"')
    expect(html).not.toContain('aria-label="主导航"')
  })

  it('does not render a prompt after login', () => {
    state.authenticated = true
    expect(renderToStaticMarkup(<StaticRouter location="/search"><SearchPage /></StaticRouter>)).not.toContain('aria-label="登录引导"')
  })
})
