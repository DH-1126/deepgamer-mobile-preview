import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getProfileSellerRoute } from '../components/profileSellerModel'
import { sellerApplicationRepository } from '../repository/sellerApplicationRepository'
import { SellerCenterPage } from './SellerContractPages'

describe('profile seller-card destinations', () => {
  beforeEach(() => { sellerApplicationRepository.save({ status: 'active', subject: 'business', entityType: 'company' }) })

  it.each([
    ['buyer', '开通卖家身份'], ['signing', '审核已通过'], ['review', '平台审核中'],
    ['rejected', '部分资料需要重新提交'], ['seller', '卖家身份已开通'],
  ] as const)('opens %s preview even with an existing active application, without mutating it', (state, heading) => {
    const original = sellerApplicationRepository.getSnapshot()
    const html = renderToStaticMarkup(<StaticRouter location={getProfileSellerRoute(state)}><SellerCenterPage /></StaticRouter>)
    expect(html).toContain(heading)
    const topBar = html.match(/<header data-ui="PageHeader"[\s\S]*?<\/header>/)?.[0] ?? ''
    expect(topBar).toContain('seller-contract-v2-topbar')
    expect(topBar).toContain('data-ui="IconButton"')
    expect(topBar.match(/data-ui="IconButton"/g)).toHaveLength(1)
    expect(topBar).toContain('aria-label="返回"')
    expect(topBar.indexOf('aria-label="返回"')).toBeLessThan(topBar.indexOf('data-ui="Heading"'))
    expect(sellerApplicationRepository.getSnapshot()).toEqual(original)
  })
})
