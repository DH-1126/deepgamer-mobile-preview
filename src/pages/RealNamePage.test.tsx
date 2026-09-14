import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import { RealNamePage } from './RealNamePage'

const renderPage = (location: string) => renderToStaticMarkup(<StaticRouter location={location}><RealNamePage /></StaticRouter>)

describe('RealNamePage preview states', () => {
  it.each([
    ['success', '认证成功'],
    ['reviewing', '认证审核中'],
    ['rejected', '认证未通过'],
  ])('makes the %s status artwork an accessible preview control', (scenario, title) => {
    const html = renderPage(`/realname?scenario=${scenario}`)
    expect(html).toContain(`data-scenario="${scenario}"`)
    expect(html).toContain(title)
    expect(html).toContain(`aria-label="预览未实名填写状态，当前${title}"`)
    expect(html).toContain('class="realname-v2-result-preview"')
  })

  it('offers a matching top icon for returning to the verified preview from the form', () => {
    const html = renderPage('/realname?scenario=fill')
    expect(html).toContain('data-scenario="fill"')
    expect(html).toContain('aria-label="预览已实名状态"')
    expect(html).toContain('class="realname-v2-fill-preview"')
  })

  it('does not put an unmasked demo identity in the rendered result', () => {
    const html = renderPage('/realname?scenario=success')
    expect(html).toContain('邓**')
    expect(html).toContain('4201*********214')
    expect(html).not.toContain('邓小明')
    expect(html).not.toContain('420101199001012214')
  })
})
