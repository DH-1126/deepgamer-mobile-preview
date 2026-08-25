import { describe, expect, it } from 'vitest'
import { buildOrderPreviewUrl, canPurchase, getPurchaseAmount, nextGalleryIndex, requiresSecondConfirmation } from './productDetailModel'

describe('productDetailModel', () => {
  it('标准版与包赔版金额、二次确认规则明确', () => {
    expect(getPurchaseAmount(3308, 'STANDARD')).toBe(3308)
    expect(getPurchaseAmount(3308, 'PREMIUM')).toBe(3573)
    expect(requiresSecondConfirmation('STANDARD')).toBe(true)
    expect(requiresSecondConfirmation('PREMIUM')).toBe(false)
  })

  it('生成可直接访问的订单预览 URL', () => {
    expect(buildOrderPreviewUrl('2114872829163482747', 'PREMIUM')).toBe('/orders/preview?goodsId=2114872829163482747&packageType=PREMIUM')
  })

  it('非在售状态不可购买', () => {
    expect(canPurchase({ status: 'on_sale' })).toBe(true)
    expect(canPurchase({ status: 'reserved' })).toBe(false)
    expect(canPurchase({ status: 'sold' })).toBe(false)
  })

  it('图库索引首尾循环', () => {
    expect(nextGalleryIndex(0, -1, 34)).toBe(33)
    expect(nextGalleryIndex(33, 1, 34)).toBe(0)
  })
})
