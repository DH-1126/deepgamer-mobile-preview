import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AssetInventory, AssetInventoryPanel, getAssetInventoryRowCount } from './AssetInventory'
import type { ProductDetail } from '../../types/productDetail'
import { productDetailRepository } from '../../repository/productDetailRepository'

const detail = { id: '1', presentationSource: 'design_fixture', assetCategories: [{ name: '英雄', count: 108, items: ['白起', '亚瑟', '荆轲', '妲己'] }] } as unknown as ProductDetail
describe('AssetInventory', () => {
  it('renders the overview and fixture disclosure', () => {
    const html = renderToStaticMarkup(<AssetInventory detail={detail} onOpenAll={vi.fn()} />)
    expect(html).toContain('资产概览'); expect(html).toContain('全服121')
    expect(html).toContain('dg-tabs--underline dg-tabs--md')
    expect(html).not.toContain('dg-tabs--underline-secondary')
    expect(html).toContain('dg-tabs--wrap')
    for (const ratio of ['21/24', '18/18', '14/15', '12/12']) expect(html).toContain(ratio)
    expect(html).not.toContain('数据来自验号报告')
    expect(html).not.toContain('星元')
    expect(html).toContain('alt="验号通过"')
    expect(html).toContain('verification-seal-v2.png')
    expect(html).not.toContain('verification-stamp.png')
    expect(html).toContain('width="128"')
    expect(html).toContain('height="128"')
    expect(html.match(/data-ui="VerificationSeal"/g)).toHaveLength(1)
    expect(html).toContain('dg-verification-seal--watermark asset-overview-seal')
    expect(html).not.toContain('asset-inventory-verification')
    expect(html).toContain('draggable="false"')
    expect(html).toContain('data-column-count="4"')
    expect(html).toContain('data-row-count="2"')
    expect(html.match(/class="asset-inventory-tile"/g)).toHaveLength(7)
    expect(html).toContain('白起资产预览')
    expect(html).toContain('荆轲资产预览')
    expect(html).toContain('aria-label="查看全部英雄资产"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('收起')
    expect(html).not.toContain('铠资产预览')
  })
  it('reports zero, partial, and more-than-ten grid rows using the real four-column layout', () => {
    expect(getAssetInventoryRowCount(0)).toBe(0)
    expect(getAssetInventoryRowCount(3)).toBe(1)
    expect(getAssetInventoryRowCount(41)).toBe(11)
  })
  it('renders an honest empty state without an empty grid', () => {
    const emptyDetail = { ...detail, id: 'empty', presentationSource: undefined, assetCategories: [{ name: '英雄', count: 0, items: [] }] } as unknown as ProductDetail
    const html = renderToStaticMarkup(<AssetInventory detail={emptyDetail} />)
    expect(html).toContain('暂无已提供的资产明细')
    expect(html).not.toContain('class="asset-inventory-grid"')
  })
  it('keeps long supplied inventories collapsed until explicitly expanded', () => {
    const items = Array.from({ length: 41 }, (_, index) => `英雄${index + 1}`)
    const longDetail = { ...detail, id: 'long', presentationSource: undefined, assetCategories: [{ name: '英雄', count: 41, items }] } as unknown as ProductDetail
    const html = renderToStaticMarkup(<AssetInventory detail={longDetail} />)
    expect(html.match(/class="asset-inventory-tile"/g)).toHaveLength(7)
    expect(html).toContain('data-row-count="2"')
    expect(html).toContain('查看全部')
    expect(html).toContain('共 41 项')
    expect(html).not.toContain('英雄8资产预览')
    expect(html).not.toContain('英雄41资产预览')
  })
  it.each([1, 7, 8])('shows all %s supplied items when they fit within two rows', count => {
    const shortDetail = { ...detail, id: 'short', presentationSource: undefined, assetCategories: [{ name: '英雄', count, items: Array.from({ length: count }, (_, index) => `英雄${index + 1}`) }] } as unknown as ProductDetail
    const html = renderToStaticMarkup(<AssetInventory detail={shortDetail} />)
    expect(html.match(/class="asset-inventory-tile"/g)).toHaveLength(count)
    expect(html).not.toContain('查看全部')
    expect(html).not.toContain('收起')
  })
  it('keeps the verified watermark without rendering seller verification copy for non-King or linked inventory', () => {
    const nonKingDetail = { ...detail, id: 'delta', presentationSource: undefined, gameName: '三角洲行动', verified: false, assetCategories: [{ name: '近战武器', count: 1, items: ['处刑者'] }] } as unknown as ProductDetail
    for (const html of [
      renderToStaticMarkup(<AssetInventory detail={nonKingDetail} />),
      renderToStaticMarkup(<AssetInventory detail={detail} linked />),
    ]) {
      expect(html).toContain('alt="验号通过"')
      expect(html).not.toContain('待核验')
    }
  })
  it('retains an honest missing-detail note for a partially supplied seller category', () => {
    const partialDetail = { ...detail, id: 'partial', presentationSource: undefined, assetCategories: [{ name: '皮肤', count: 2, items: ['已提供皮肤'] }] } as unknown as ProductDetail
    const html = renderToStaticMarkup(<AssetInventory detail={partialDetail} linked />)
    expect(html).toContain('当前已提供 1 项皮肤明细，其余明细待补充。')
    expect(html).not.toContain('卖家填写，待核验')
  })
  it('renders the full panel when opened', () => {
    const html = renderToStaticMarkup(<AssetInventoryPanel open onClose={vi.fn()} detail={detail} initialCategory="英雄" />)
    expect(html).toContain('当前展示 24 项已提供英雄明细')
  })
  it('opens the full inventory with the profession chosen in the preview', () => {
    const html = renderToStaticMarkup(<AssetInventoryPanel open onClose={vi.fn()} detail={detail} initialCategory="英雄" initialGroup="射手" />)
    expect(html).toMatch(/aria-selected="true"[^>]*>射手/)
    expect(html).toContain('孙尚香资产预览')
    expect(html).not.toContain('李白资产预览')
  })
  it('uses the same searchable grid and quality filters for skins, without hero stats or a star tab', () => {
    const html = renderToStaticMarkup(<AssetInventoryPanel open onClose={vi.fn()} detail={productDetailRepository.getById('1')!} initialCategory="皮肤" />)
    for (const content of ['全部皮肤', 'SearchField', '皮肤品质筛选', 'asset-panel-grid', '倪克斯神谕', '时之魔女', '顽趣', '五谷丰年', '唐三藏', '时之奇旅', '已拥有皮肤', '当前展示 6 项皮肤明细']) expect(html).toContain(content)
    expect(html).not.toContain('星元')
    expect(html).not.toContain('已拥有英雄')
    expect(html).not.toContain('已有8皮肤')
    expect(html.match(/class="asset-panel-card"/g)).toHaveLength(6)
    expect(html.match(/data-cropped="true"/g)).toHaveLength(4)
  })
  it('does not turn unavailable skin detail into a fake empty owned collection', () => {
    const html = renderToStaticMarkup(<AssetInventoryPanel open onClose={vi.fn()} detail={productDetailRepository.getById('1')!} initialCategory="皮肤" initialGroup="传说" />)
    expect(html).toContain('暂未提供该分类的皮肤明细')
    expect(html).not.toContain('暂无可展示资产')
    expect(html).not.toContain('class="asset-panel-card"')
  })
})
