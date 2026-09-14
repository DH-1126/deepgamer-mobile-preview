import { catalogProductDetails, deltaProductDetail } from '../data/productDetailFixtures'
import type { ProductDetail } from '../types/productDetail'
import { getLinkedState, subscribeLinkedState, toProductDetail } from '../linked/linkedData'
import { isLinkedDataMode } from '../runtime/dataMode'

const details = [...catalogProductDetails, deltaProductDetail]

export const productDetailRepository = {
  getById(id: string): ProductDetail | undefined {
    if (isLinkedDataMode) {
      const state = getLinkedState()
      const goods = state?.goods.find((item) => item.id === id || item.goodsNo === id)
      const game = goods && state?.games.find((item) => item.code === goods.gameCode)
      if (!goods || !game || game.status !== 'ACTIVE' || goods.auditStatus !== 'APPROVED') return undefined
      return toProductDetail(goods, game)
    }
    return details.find((detail) => detail.id === id || detail.aliases.includes(id))
  },
  getSimilar(detail: ProductDetail): ProductDetail[] {
    if (isLinkedDataMode) {
      const state = getLinkedState()
      if (!state) return []
      return state.goods.filter((goods) => goods.id !== detail.id && goods.gameCode === detail.gameCode && goods.auditStatus === 'APPROVED' && goods.productStatus === 'ON_SALE').slice(0, 3).flatMap((goods) => {
        const game = state.games.find((item) => item.code === goods.gameCode)
        return game ? [toProductDetail(goods, game)] : []
      })
    }
    return details.filter((item) => item.id !== detail.id && item.gameCode === detail.gameCode).slice(0, 3)
  },
  subscribe(listener: () => void) { return isLinkedDataMode ? subscribeLinkedState(listener) : () => undefined },
}
