import { describe, expect, it } from 'vitest'
import type { OrderRecord, OrderStatus } from '../types/order'
import { formatOrderListMoney, getOrderListPresentation } from './orderListPresentation'

const now = 2_000_000_000_000
const base: OrderRecord = { id: 'OD-1', role: 'buyer', status: 'pending', productId: 'p-1', productTitle: '很长很长的账号商品标题，用来验证展示不会改变真实商品数据', gameName: '王者荣耀', gameCode: 'wzry', server: '安卓QQ', thumbnail: '/game.png', goodsAmountCents: 1644280, serviceAmountCents: 0, insuranceAmountCents: 0, totalAmountCents: 1644280, createdAt: now, updatedAt: now, expiresAt: now + 27 * 60_000 + 52_000, conversationId: 'trade-1' }

describe('getOrderListPresentation', () => {
  it('formats grouped amounts with two decimals and does not invent cancellation or refund details', () => {
    expect(formatOrderListMoney(1644280)).toBe('¥16,442.80')
    expect(formatOrderListMoney(1288000)).toBe('¥12,880.00')
    expect(getOrderListPresentation({ ...base, status: 'cancelled', cancelReason: '价格太高了' }, now).description).toBe('你取消了订单 · 价格太高了')
    expect(getOrderListPresentation({ ...base, status: 'cancelled' }, now).description).toBe('你取消了订单')
    expect(getOrderListPresentation({ ...base, status: 'closed' }, now).description).not.toContain('已原路退回')
  })
  it.each<[OrderStatus, string]>([['pending', '待付款'], ['paid', '待资料同步'], ['verifying', '验号中'], ['binding', '换绑中'], ['signed', '签署完成'], ['insuring', '投保中'], ['insured', '投保成功'], ['bind_success', '待放款'], ['completed', '已完成'], ['closed', '已关闭'], ['pay_expired', '已过期'], ['cancelled', '已关闭']])('covers %s', (status, label) => {
    const view = getOrderListPresentation({ ...base, status }, now)
    expect(view.statusLabel).toBe(label)
    expect(view.amountCents).toBe(1644280)
  })

  it('uses cancellable payment routes and safe detail fallback when there is no conversation', () => {
    const pending = getOrderListPresentation(base, now)
    expect(pending.countdown).toBe('27:52')
    expect(pending.actions.map(action => action.to)).toEqual(['/payment/cancel?id=OD-1', '/orders/checkout?id=OD-1'])
    const paid = getOrderListPresentation({ ...base, status: 'paid', conversationId: undefined }, now)
    expect(paid.actions[1]).toMatchObject({ label: '查看进度', to: '/orders/OD-1' })
  })

  it('keeps optional post-sale, refund and recycle details without overriding money', () => {
    const completed = getOrderListPresentation({ ...base, status: 'completed', afterSaleEndsAt: new Date('2026-09-14T00:00:00').getTime() } as OrderRecord, now)
    expect(completed.description).toContain('09-14')
    const closed = getOrderListPresentation({ ...base, status: 'closed', refundAmountCents: 1234 } as OrderRecord, now)
    expect(closed.description).toContain('¥12.34')
    const recycle = getOrderListPresentation({ ...base, role: 'seller', status: 'completed', orderKind: 'recycle', goodsAmountCents: 1288000, totalAmountCents: 999 } as OrderRecord, now)
    expect(recycle).toMatchObject({ isRecycle: true, statusLabel: '已打款', amountCents: 1288000 })
    expect(recycle.actions.map(action => action.label)).toEqual(['联系客服', '查看打款明细'])
  })
})
