import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import { OrderListPage, PaymentCancelPage } from './OrderPages'
import { AfterSaleApplyPage } from './AfterSalesPage'

describe('order list integration', () => {
  it('uses the reusable card for every buyer order while retaining search and tabs', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/orders?role=buyer"><OrderListPage /></StaticRouter>)
    expect(html.match(/data-ui="OrderListCard"/g)).toHaveLength(17)
    expect(html).toContain('搜索订单号、商品编号、游戏或商品')
    expect(html).toContain('订单状态筛选')
    expect(html).toContain('¥16,442.80')
    expect(html).toContain('剩余有效期')
    expect(html).toContain('申请售后')
  })

  it('connects the completed recycle card to an on-page payout action', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/orders?role=seller&status=completed"><OrderListPage /></StaticRouter>)
    expect(html.match(/data-ui="OrderListCard"/g)).toHaveLength(1)
    expect(html).toContain('已打款')
    expect(html).toContain('查看打款明细')
    expect(html).not.toContain('/wallet?orderId=')
  })

  it('opens cancellation for the selected order and supports its own reason selection', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/payment/cancel?id=OD3015035674505896501"><PaymentCancelPage /></StaticRouter>)
    expect(html).toContain('为什么取消？')
    expect(html).toContain('价格太高了')
    expect(html).toContain('id=OD3015035674505896501')
  })

  it('does not claim completed-order money is still held in escrow on the after-sales destination', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/aftersales/apply?orderId=OD3015035674505896506"><AfterSaleApplyPage /></StaticRouter>)
    expect(html).toContain('已完成订单申请售后')
    expect(html).toContain('OD3015035674505896506')
    expect(html).not.toContain('仍在平台托管')
  })
})
