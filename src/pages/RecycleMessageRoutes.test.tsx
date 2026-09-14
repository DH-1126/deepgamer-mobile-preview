import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-router-dom', async () => ({ ...await vi.importActual<typeof import('react-router-dom')>('react-router-dom'), Navigate: ({ to, replace }: { to: string; replace?: boolean }) => <span data-redirect={to} data-replace={replace} /> }))
import { RecycleOrderListPage } from './RecycleOrderListPage'
import { SellGoodsPage } from './SellPages'

describe('legacy consultation list routes', () => {
  it.each([RecycleOrderListPage, SellGoodsPage])('redirects to the message recycle tab without rendering a separate order list', Page => {
    const html = renderToStaticMarkup(<Page />)
    expect(html).toContain('data-redirect="/message?tab=recycle"')
    expect(html).toContain('data-replace="true"')
    expect(html).not.toContain('recycle-v2-card')
    expect(html).not.toContain('新咨询')
  })
})
