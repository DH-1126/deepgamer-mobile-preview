import { describe, expect, it } from 'vitest'
import { assetImage, assetProgress, createAssetPreviewView, createAssetView, designFixtureSkinItems, filterAssetItems, getVisibleAssetCategories } from './assetInventoryModel'
import type { ProductDetail } from '../../types/productDetail'
import { productDetailRepository } from '../../repository/productDetailRepository'

describe('asset inventory model', () => {
  const entries = [{ name: '李白', group: '荣耀典藏' as const }, { name: '镜', group: '限定' as const }]
  it('filters only by submitted keyword and selected group without mutating input', () => {
    const original = [...entries]
    expect(filterAssetItems(entries, '全部', ' 镜 ')).toEqual([entries[1]])
    expect(filterAssetItems(entries, '荣耀典藏', '')).toEqual([entries[0]])
    expect(entries).toEqual(original)
  })
  it('calculates the correct denominator-based progress', () => { expect(assetProgress(108, 121)).toBe(89); expect(assetProgress(null, 121)).toBeNull() })
  it('does not present seller or linked assets as a verification report', () => {
    const detail = { id: 'other', verified: false, assetCategories: [{ name: '武器', count: 3, items: ['A'] }] } as unknown as ProductDetail
    expect(createAssetView(detail, '武器').source).toBe('seller_submitted')
    expect(createAssetView({ ...detail, verified: true }, '武器').source).toBe('verified_report')
    expect(createAssetView({ ...detail, verified: true }, '武器', true).source).toBe('seller_submitted')
  })
  it('does not reuse the hero list as skins or star parts', () => {
    const specimen = productDetailRepository.getById('1')!
    const heroes = createAssetView(specimen, '英雄').items
    expect(heroes).toHaveLength(24)
    expect(new Set(heroes.map(item => item.name)).size).toBe(24)
    expect(heroes.find(item => item.name === '白起')?.image).toContain('hero-1.png')
    expect(heroes.find(item => item.name === '荆轲')?.image).toContain('hero-3.png')
    expect(createAssetView(specimen, '皮肤').items.map(item => item.name)).toEqual([...designFixtureSkinItems.map(item => item.name), ...specimen.assetCategories.find(item => item.name === '皮肤')!.items])
    expect(createAssetView(specimen, '星元').items.map(item => item.name)).toEqual(['稀有星元部件'])
    expect(createAssetView(specimen, '皮肤').items.some(item => item.name === '李白')).toBe(false)
  })
  it('filters professions with the same submitted-search contract', () => {
    const items = createAssetView(productDetailRepository.getById('1')!, '英雄').items
    expect(filterAssetItems(items, '刺客', '李白').map(item => item.name)).toEqual(['李白'])
    expect(filterAssetItems(items, '射手', '李白')).toEqual([])
  })
  it('keeps skin detail separate from heroes and removes stars only from visible categories', () => {
    const specimen = productDetailRepository.getById('1')!
    const skins = createAssetView(specimen, '皮肤')
    expect(getVisibleAssetCategories(specimen)).toEqual(['英雄', '皮肤'])
    expect(getVisibleAssetCategories(specimen, true)).not.toContain('星元')
    expect(specimen.assetCategories.some(category => category.name === '星元')).toBe(true)
    expect(skins.total).toBe(312)
    expect(skins.items).toHaveLength(6)
    expect(filterAssetItems(skins.items, '荣耀典藏', '倪克斯').map(item => item.name)).toEqual(['倪克斯神谕'])
    expect(assetImage(skins.items[0])).toContain('/product-detail-v2/screen-1.png')
    expect(createAssetView(specimen, '皮肤', true).items.every(item => !item.rarity)).toBe(true)
    expect(createAssetView(specimen, '皮肤', true).items).toHaveLength(2)
  })

  it('supplies four different photographed skin crops for the design specimen preview', () => {
    const items = createAssetPreviewView(productDetailRepository.getById('1')!, '皮肤').items.slice(0, 4)
    expect(items.map(item => item.name)).toEqual(['顽趣', '五谷丰年', '唐三藏', '时之奇旅'])
    expect(new Set(items.map(item => item.imageCrop?.x)).size).toBe(4)
    for (const item of items) {
      expect(item.kind).toBe('skin')
      expect(item.image).toContain('screen-1.png')
      const crop = item.imageCrop!
      expect(crop.x + crop.width).toBeLessThanOrEqual(crop.sourceWidth)
      expect(crop.y + crop.height).toBeLessThanOrEqual(crop.sourceHeight)
    }
  })
})
