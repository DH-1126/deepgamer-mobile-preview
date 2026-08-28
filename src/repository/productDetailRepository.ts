import { catalogProductDetails, deltaProductDetail } from '../data/productDetailFixtures'
import type { ProductDetail } from '../types/productDetail'

const details = [...catalogProductDetails, deltaProductDetail]

export const productDetailRepository = {
  getById(id: string): ProductDetail | undefined {
    return details.find((detail) => detail.id === id || detail.aliases.includes(id))
  },
  getSimilar(detail: ProductDetail): ProductDetail[] {
    return details.filter((item) => item.id !== detail.id && item.gameCode === detail.gameCode).slice(0, 3)
  },
}
