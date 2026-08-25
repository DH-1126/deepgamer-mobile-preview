import { describe, expect, it } from 'vitest'
import { products } from '../data/fixtures'
import { deltaGallery } from '../data/productDetailFixtures'
import { productDetailRepository } from './productDetailRepository'

describe('productDetailRepository', () => {
  it('支持长 ID 与商品号别名，并保留 HTML 三角洲身份', () => {
    const detail = productDetailRepository.getById('2114872829163482747')
    expect(detail?.productCode).toBe('SJ11DG001')
    expect(detail?.gameName).toBe('三角洲行动')
    expect(detail?.price).toBe(3308)
    expect(detail?.assetCategories.find((category) => category.name === '武器皮肤')?.items).toHaveLength(98)
    expect(productDetailRepository.getById('SJ11DG001')?.id).toBe(detail?.id)
  })

  it('未知 ID 不回退到任意商品', () => {
    expect(productDetailRepository.getById('missing')).toBeUndefined()
  })

  it('目录每条商品映射自身详情身份', () => {
    for (const product of products) {
      const detail = productDetailRepository.getById(product.id)
      expect(detail?.id).toBe(product.id)
      expect(detail?.title).toBe(product.title)
      expect(detail?.price).toBe(product.price)
      expect(detail?.platform).toBe(product.platform)
      expect(detail?.gallery[0]).toBe(product.image)
    }
  })

  it('三角洲图库按 HTML 去重映射 34 张图片', () => {
    expect(deltaGallery).toHaveLength(34)
    expect(new Set(deltaGallery).size).toBe(34)
    expect(deltaGallery[0]).toContain('780e9aff')
    expect(deltaGallery[33]).toContain('bf29e38e')
  })
})
