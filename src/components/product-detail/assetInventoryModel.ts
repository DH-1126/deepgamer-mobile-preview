import type { AssetCategory, ProductDetail } from '../../types/productDetail'
import { assetPath } from '../assetPath'

export type AssetGroup = '荣耀典藏' | '限定' | '传说' | '史诗' | '无双' | '珍品传说' | '其他'
export type AssetImageCrop = { x: number; y: number; width: number; height: number; sourceWidth: number; sourceHeight: number }
export type AssetItem = { name: string; group: AssetGroup; kind?: 'hero' | 'skin'; rarity?: '典藏' | '限定' | '传说' | '史诗' | '无双' | '珍品传说'; profession?: '法师' | '战士' | '射手' | '坦克' | '刺客'; skinCount?: number; image?: string; imageCrop?: AssetImageCrop }
export type AssetView = { source: 'design_fixture' | 'verified_report' | 'seller_submitted'; category: string; total: number | null; items: AssetItem[]; note?: string }

const heroImages: Record<string, string> = {
  白起: assetPath('assets/product-detail-draft5/hero-1.png'),
  亚瑟: assetPath('assets/product-detail-draft5/hero-2.png'),
  荆轲: assetPath('assets/product-detail-draft5/hero-3.png'),
  妲己: assetPath('assets/product-detail-draft5/hero-4.png'),
}
const placeholder = assetPath('assets/product-detail-draft5/asset-person.svg')
const professions: Record<string, AssetItem['profession']> = { 白起: '坦克', 荆轲: '刺客', 李白: '刺客', 镜: '刺客', 韩信: '刺客', 云中君: '刺客', 澜: '刺客', 貂蝉: '法师', 女娲: '法师', 孙尚香: '射手', 梦奇: '坦克', 大乔: '法师', 公孙离: '射手', 上官婉儿: '法师', 猪八戒: '坦克', 司空震: '战士', 鲁班七号: '射手', 后羿: '射手', 妲己: '法师', 亚瑟: '战士', 安琪拉: '法师', 孙悟空: '战士', 露娜: '法师', 铠: '战士' }
const item = (name: string, group: AssetGroup, skinCount: number, rarity?: AssetItem['rarity']): AssetItem => ({ name, group, skinCount, rarity, profession: professions[name] })

/** The Figma screen contains 22 named examples, not a complete account export. */
export const designFixtureItems: AssetItem[] = [
  ...[['李白', 9], ['貂蝉', 8], ['女娲', 5], ['孙尚香', 7], ['梦奇', 4], ['大乔', 6]].map(([name, skins]) => item(name as string, '荣耀典藏', skins as number, '典藏')),
  ...[['镜', 6], ['韩信', 11], ['公孙离', 8], ['云中君', 5], ['澜', 4], ['上官婉儿', 7], ['猪八戒', 3], ['司空震', 3]].map(([name, skins]) => item(name as string, '限定', skins as number, '限定')),
  ...[['鲁班七号', 5], ['后羿', 6], ['妲己', 7], ['亚瑟', 5], ['安琪拉', 4], ['孙悟空', 8], ['露娜', 6], ['铠', 5]].map(([name, skins]) => item(name as string, '其他', skins as number, '传说')),
]
export const designFixtureGroupTotals: Partial<Record<AssetGroup, number>> = { 荣耀典藏: 6, 限定: 14, 其他: 88 }
/** Existing specimen tags supply these skin names; do not turn hero portraits into skins. */
const specimenSkinKinds: Record<string, AssetItem['rarity']> = { 倪克斯神谕: '典藏', 时之魔女: '典藏' }
/** Four user-requested preview specimens, named from the existing skin screenshot.
 * CSS crops use the original image without creating duplicate bitmap files.
 * These examples never apply to live/linked goods or imply a complete account export.
 */
export const designFixtureSkinItems: AssetItem[] = [
  { name: '顽趣', x: 10 },
  { name: '五谷丰年', x: 338 },
  { name: '唐三藏', x: 664 },
  { name: '时之奇旅', x: 986 },
].map(({ name, x }) => ({
  name, kind: 'skin', group: name === '时之奇旅' ? '史诗' : '其他', rarity: name === '时之奇旅' ? '史诗' : undefined,
  image: assetPath('assets/product-detail-v2/screen-1.png'),
  imageCrop: { x, y: 72, width: 280, height: 280, sourceWidth: 1272, sourceHeight: 942 },
}))
export const designSkinFilters = [
  { value: '全部', label: '全部', count: 312, owned: 312 },
  { value: '荣耀典藏', label: '典藏', count: 3, owned: 3 },
  { value: '无双', label: '无双', count: 2, owned: 2 },
  { value: '传说', label: '传说', count: 41, owned: 41 },
  { value: '史诗', label: '史诗', count: 96, owned: 96 },
  { value: '珍品传说', label: '珍品传说', count: 2, owned: 2 },
]
/** Summary counts from the asset tab, not inferred from the partial hero examples. */
export const designProfessionFilters = [
  { value: '全部', label: '全部', owned: 108 },
  { value: '法师', label: '法师', count: '21/24', owned: 21 },
  { value: '战士', label: '战士', count: '18/18', owned: 18 },
  { value: '射手', label: '射手', count: '14/15', owned: 14 },
  { value: '坦克', label: '坦克', count: '12/12', owned: 12 },
]
export const fixturePreviewItems: AssetItem[] = ['白起', '亚瑟', '荆轲', '妲己'].map(name => ({ name, group: '其他', profession: professions[name], image: heroImages[name], rarity: name === '白起' ? '典藏' : name === '亚瑟' ? '传说' : undefined }))

/** Merge the photographed hero specimens into the supplied design list by name.
 * This preserves every provided image without presenting duplicate heroes.
 */
function createDesignFixtureHeroItems() {
  return [
    ...fixturePreviewItems,
    ...designFixtureItems.filter(item => !fixturePreviewItems.some(preview => preview.name === item.name)),
  ]
}

export function isDesignAssetFixture(detail: ProductDetail, linked = false) { return detail.id === '1' && !linked && detail.presentationSource === 'design_fixture' }
export function getAssetCategory(detail: ProductDetail, name: string): AssetCategory | undefined { return detail.assetCategories.find(category => category.name === name) }
export function getVisibleAssetCategories(detail: ProductDetail, linked = false) {
  return isDesignAssetFixture(detail, linked) ? ['英雄', '皮肤'] : detail.assetCategories.filter(category => category.name !== '星元').map(category => category.name)
}
export function createAssetView(detail: ProductDetail, category: string, linked = false): AssetView {
  const source = isDesignAssetFixture(detail, linked) ? 'design_fixture' : !linked && detail.verified ? 'verified_report' : 'seller_submitted'
  if (source === 'design_fixture' && category === '英雄') {
    const items = createDesignFixtureHeroItems()
    return { source, category, total: 108, items, note: `当前展示 ${items.length} 项已提供英雄明细，并非完整 108 位英雄清单。` }
  }
  const provided = getAssetCategory(detail, category)
  if (category === '皮肤') {
    const providedItems: AssetItem[] = (provided?.items ?? []).map(name => {
      const rarity = source === 'design_fixture' ? specimenSkinKinds[name] : undefined
      return { name, kind: 'skin', group: rarity === '典藏' ? '荣耀典藏' : '其他', rarity }
    })
    const items = source === 'design_fixture' ? [...designFixtureSkinItems, ...providedItems.filter(item => !designFixtureSkinItems.some(example => example.name === item.name))] : providedItems
    const total = provided?.count ?? null
    return { source, category, total, items, note: source === 'design_fixture' ? `当前展示 ${items.length} 项皮肤明细（含 4 项素材示例），其余明细待补充。` : total != null && items.length < total ? `当前已提供 ${items.length} 项皮肤明细，其余明细待补充。` : undefined }
  }
  return { source, category, total: provided?.count ?? null, items: (provided?.items ?? []).map(name => ({ name, group: '其他', image: heroImages[name] })), note: source === 'seller_submitted' ? '卖家填写，待核验' : undefined }
}
export function createAssetPreviewView(detail: ProductDetail, category: string, linked = false): AssetView {
  if (isDesignAssetFixture(detail, linked) && category === '英雄') return { source: 'design_fixture', category, total: 108, items: fixturePreviewItems }
  return createAssetView(detail, category, linked)
}
export function filterAssetItems(items: readonly AssetItem[], group: string, submittedKeyword: string) {
  const keyword = submittedKeyword.trim().toLocaleLowerCase()
  return items.filter(entry => (group === '全部' || entry.group === group || entry.profession === group || entry.rarity === group) && (!keyword || entry.name.toLocaleLowerCase().includes(keyword)))
}
export function assetProgress(owned: number | null, total: number | null) { return owned != null && total != null && total > 0 ? Math.min(100, Math.round(owned / total * 100)) : null }
export function assetImage(entry: AssetItem) { return entry.image || (entry.kind === 'skin' ? assetPath('assets/filter-draft3/skin.svg') : placeholder) }
