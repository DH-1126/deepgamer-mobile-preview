import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import { OrderListPage, PaymentCancelPage, PaymentSuccessPage } from './OrderPages'
import { AfterSaleApplyPage } from './AfterSalesPage'

describe('order list integration', () => {
  it('uses the reusable card for every buyer order while retaining search and tabs', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/orders?role=buyer"><OrderListPage /></StaticRouter>)
    expect(html.match(/data-ui="OrderListCard"/g)).toHaveLength(20)
    expect(html).toContain('搜索订单号、商品编号、游戏或商品')
    expect(html).toContain('订单状态筛选')
    expect(html).toContain('¥16,442.80')
    expect(html).toContain('剩余有效期')
    expect(html).toContain('申请售后')
  })

  it('在收银台层级展示支付成功明细，并保留旧成功路由入口', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/payment/success?id=OD3015035674505896502"><PaymentSuccessPage /></StaticRouter>)
    expect(html).toContain('role="dialog"')
    expect(html).toContain('支付成功')
    expect(html).toContain('支付金额')
    expect(html).toContain('1s后自动跳转')
    expect(html).toContain('交易订单支付')
  })

  it('过期订单只展示过期失败弹窗，不会误报支付成功', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/payment/success?id=OD3015035674505896508"><PaymentSuccessPage /></StaticRouter>)
    expect(html).toContain('支付失败')
    expect(html).toContain('订单已过期')
    expect(html).not.toContain('交易资金已加密确认')
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
