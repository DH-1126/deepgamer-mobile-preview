import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { describe, expect, it } from 'vitest'
import type { OrderRecord } from '../types/order'
import { OrderListCard } from './OrderListCard'

const now = 2_000_000_000_000
const order: OrderRecord = { id: 'OD-LONG', role: 'buyer', status: 'pending', productId: 'p', productTitle: '超长超长超长的游戏账号商品标题，不应影响卡片操作区域', gameName: '王者荣耀', gameCode: 'wzry', server: '安卓QQ', thumbnail: '/assets/games/wzry.png', goodsAmountCents: 1644280, serviceAmountCents: 0, insuranceAmountCents: 0, totalAmountCents: 1644280, createdAt: now, updatedAt: now, expiresAt: now + 27 * 60_000 + 52_000, listTags: ['V11', '很长的自定义标签内容'] } as OrderRecord

describe('OrderListCard', () => {
  it('renders a linked product area, countdown, fixed-decimal amount and separate actions', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/"><OrderListCard order={order} now={now} /></StaticRouter>)
    expect(html).toContain('data-ui="OrderListCard"')
    expect(html).toContain('href="/orders/OD-LONG"')
    expect(html).toContain('剩余有效期')
    expect(html).toContain('27:52')
    expect(html).toContain('¥16,442.80')
    expect(html).toContain('href="/payment/cancel?id=OD-LONG"')
    expect(html).toContain('href="/orders/checkout?id=OD-LONG"')
    expect(html).not.toContain('<a href="/orders/OD-LONG"><a')
  })

  it('renders a recycle payment-details button and never fabricates a wallet detail route', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/"><OrderListCard order={{ ...order, role: 'seller', status: 'completed', orderKind: 'recycle', goodsAmountCents: 1288000 }} now={now} onShowPayout={() => undefined} /></StaticRouter>)
    expect(html).toContain('查看打款明细')
    expect(html).not.toContain('/wallet?orderId=')
  })

  it('falls back to real order details when an embedding page has no payout handler', () => {
    const html = renderToStaticMarkup(<StaticRouter location="/"><OrderListCard order={{ ...order, role: 'seller', status: 'completed', orderKind: 'recycle', goodsAmountCents: 1288000 } as OrderRecord} now={now} /></StaticRouter>)
    expect(html).toContain('已打款')
    expect(html).toContain('回收')
    expect(html).toContain('查看订单详情')
    expect(html).toContain('href="/orders/OD-LONG"')
    expect(html).toContain('lucide-archive')
  })
})
