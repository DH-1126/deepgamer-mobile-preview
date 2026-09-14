import { describe, expect, it, vi } from 'vitest'
import { resolveTitle, type ResolvedTitle, type TitleDefinition } from '@deepgamer/product-presentation'
import type { LinkedState } from '../../../双端演示/src/contract'
import type { Product } from '../types/catalog'
import { catalogProductToTitleProduct, fallbackLinkedEmptyPrimary, linkedAttributeValuesToTitleValues, resolveCatalogProductTitle } from './titlePresentation'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'goods-0',
  gameCode: 'wzry',
  title: '原始商品标题',
  price: 0,
  image: '/goods.png',
  tags: [],
  eliteLevel: 'V0',
  skinCount: 0,
  platform: '安卓QQ',
  rank: '倔强青铜',
  realName: '未实名',
  secondRealName: false,
  faceCompensation: false,
  listedAt: 1,
  heroCount: 0,
  inscriptionFull: false,
  ...overrides,
})

const definition = (gameCode = 'wzry'): TitleDefinition => ({
  gameCode,
  attributes: [],
  groups: [],
  template: {
    name: '标题配置',
    status: 'ACTIVE',
    definitionVersion: 'title-v2',
    sections: [],
  },
})

describe('title product projection', () => {
  it('preserves zero and false values without changing the canonical title', () => {
    const source = product()
    const projected = catalogProductToTitleProduct(source)
    expect(projected.title).toBe('原始商品标题')
    expect(projected.values.skin_count).toBe(0)
    expect(projected.values.hero_count).toBe(0)
    expect(projected.values.inscription_full).toBe(false)
    expect(source.title).toBe('原始商品标题')
  })

  it('uses the public goods number and keeps linked attributes strictly explicit', () => {
    expect(catalogProductToTitleProduct(product({ productCode: 'DG-20260911-001' })).productCode).toBe('DG-20260911-001')
    expect(linkedAttributeValuesToTitleValues({
      rank: '  ', skin_count: 0, negotiable: false, optionLabel: null,
      highlight_skins: ['', 'highlight_skins:dragon', null], invalid_key: undefined,
    })).toEqual({ skin_count: 0, negotiable: false, highlight_skins: ['highlight_skins:dragon'] })
  })

  it('does not fabricate verification state when it is false or unknown', () => {
    expect(catalogProductToTitleProduct(product({ verified: false })).verified).toBe(false)
    expect(catalogProductToTitleProduct(product({ verified: undefined })).verified).toBeUndefined()
  })

  it('falls back to the original title for a missing or cross-game definition', () => {
    const projected = catalogProductToTitleProduct(product())
    expect(resolveTitle(null, projected, 'LIST_CARD').primaryText).toBe('原始商品标题')
    const crossGame = resolveTitle(definition('dwrg'), projected, 'LIST_CARD')
    expect(crossGame.fallback).toBe(true)
    expect(crossGame.primaryText).toBe('原始商品标题')
  })

  it('falls back only EMPTY-policy primary pieces without matching rendered dash text', () => {
    const projected = catalogProductToTitleProduct(product())
    const emptyPolicyResult: ResolvedTitle = {
      placement: 'LIST_CARD', fallback: false, primaryText: '— · —', imageBadge: null, warnings: [],
      blocks: [{ key: 'configured', name: '配置标题', role: 'PRIMARY', kind: 'text', pieces: [
        { key: 'EMPTY:rank', text: '—' }, { key: 'EMPTY:skin', text: '—' },
      ], separator: ' · ', maxLines: 1, maxItems: 2, theme: 'plain' }],
    }
    expect(fallbackLinkedEmptyPrimary(emptyPolicyResult, projected, 'LIST_CARD')).toMatchObject({
      fallback: true, primaryText: '原始商品标题', blocks: [{ key: 'original-title' }],
    })

    const legitimateDashTitle = {
      ...emptyPolicyResult, primaryText: '— · —',
      blocks: [{ ...emptyPolicyResult.blocks[0], pieces: [{ key: 'STATIC:product_title', text: '— · —' }] }],
    }
    expect(fallbackLinkedEmptyPrimary(legitimateDashTitle, projected, 'LIST_CARD')).toBe(legitimateDashTitle)
  })

  it('falls back the actual linked legacy goods when its published primary fields are unavailable', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'linked')
    vi.resetModules()
    try {
      const [{ createLinkedSeed }, { getPublishedTitleConfig }, linkedData, linkedPresentation, titleClient] = await Promise.all([
        import('../../../双端演示/src/seed'),
        import('../../../双端演示/src/title-config'),
        import('../linked/linkedData'),
        import('./titlePresentation'),
        import('./titleConfigClient'),
      ])
      const seed = createLinkedSeed()
      const state: LinkedState = {
        ...seed, titleConfigs: seed.titleConfigs ?? [], publishConfigs: seed.publishConfigs ?? [], detailConfigs: seed.detailConfigs ?? [], searchConfigs: seed.searchConfigs ?? [], sessionId: 'legacy-title-regression', revision: 1, media: {},
        seller: {
          id: 'linked_seller_001', displayName: '联动演示卖家', status: 'NONE', contractStatus: 'UNSIGNED',
          rowVersion: 1, application: null, applicationId: null, reviewReason: '', submittedAt: null, reviewedAt: null,
        },
      }
      const goods = state.goods.find((item) => item.id === 'goods_demo_002')
      expect(goods).toBeDefined()
      const definition = titleClient.parseTitleDefinitionPayload(getPublishedTitleConfig(state, 'wzry'))
      expect(definition).not.toBeNull()

      const listProduct = linkedData.toCatalogProduct(goods!)
      const listResult = linkedPresentation.resolveCatalogProductTitle(definition, listProduct)
      expect(listResult.product.productCode).toBe(goods!.goodsNo)
      const rawPrimary = resolveTitle(definition, listResult.product, 'LIST_CARD').blocks.find((block) => block.role === 'PRIMARY')
      expect(rawPrimary?.pieces.length).toBeGreaterThan(0)
      expect(rawPrimary?.pieces.every((piece) => piece.key.startsWith('EMPTY:'))).toBe(true)
      expect(listResult.result).toMatchObject({ fallback: true, primaryText: goods!.title })

      const game = state.games.find((item) => item.code === 'wzry')!
      const detail = linkedData.toProductDetail(goods!, game)
      expect(linkedPresentation.resolveDetailProductTitle(definition, detail).result.primaryText).toBe(goods!.title)
    } finally {
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })

  it('resolves multiple title pieces, multiple tags and an image badge from explicit public option IDs', () => {
    const configured: TitleDefinition = {
      gameCode: 'wzry',
      groups: [{ id: 'group-highlight', key: 'highlight', name: '亮点', status: 'ACTIVE', attributeIds: ['attr-highlight'], optionIds: ['skin-a', 'skin-b'] }],
      attributes: [
        { id: 'attr-rank', logicalKey: 'rank', name: '段位', valueType: 'TEXT', status: 'ACTIVE', options: [] },
        { id: 'attr-hero', logicalKey: 'hero_count', name: '英雄数量', valueType: 'NUMBER', status: 'ACTIVE', options: [] },
        { id: 'attr-skin', logicalKey: 'skin_count', name: '皮肤数量', valueType: 'NUMBER', status: 'ACTIVE', options: [] },
        { id: 'attr-highlight', logicalKey: 'highlight_skins', name: '亮点皮肤', valueType: 'ENUM', status: 'ACTIVE', options: [
          { id: 'skin-a', fullKey: 'highlight_skins:alice', name: '爱丽丝神偷', status: 'ACTIVE', sortOrder: 1 },
          { id: 'skin-b', fullKey: 'highlight_skins:dragon', name: '神龙摆尾', status: 'ACTIVE', sortOrder: 2 },
        ] },
        { id: 'attr-noble', logicalKey: 'noble_level', name: '贵族等级', valueType: 'ENUM', status: 'ACTIVE', options: [
          { id: 'noble-8', fullKey: 'noble_level:8', name: '贵族8', status: 'ACTIVE', sortOrder: 8 },
        ] },
      ],
      template: {
        name: '王者标题', status: 'ACTIVE', definitionVersion: 'title-v2', sceneSettings: { LIST_CARD: true }, sections: [
          { sectionKey: 'primary', title: '主标题', displayType: 'TITLE_TEXT', placement: 'LIST_CARD', sortOrder: 1, status: 'ACTIVE', presentation: { role: 'PRIMARY', separator: ' · ', maxItems: 4 }, fields: [
            { fieldKey: 'rank-1', label: '段位', sourceType: 'ATTRIBUTE', sourceId: 'attr-rank', sortOrder: 1, status: 'ACTIVE', display: {} },
            { fieldKey: 'hero-1', label: '英雄', sourceType: 'ATTRIBUTE', sourceId: 'attr-hero', sortOrder: 2, status: 'ACTIVE', display: { suffix: '英雄' } },
            { fieldKey: 'skin-1', label: '皮肤', sourceType: 'ATTRIBUTE', sourceId: 'attr-skin', sortOrder: 3, status: 'ACTIVE', display: { suffix: '皮肤' } },
          ] },
          { sectionKey: 'tags', title: '亮点标签', displayType: 'TITLE_TAGS', placement: 'LIST_CARD', sortOrder: 2, status: 'ACTIVE', presentation: { role: 'SECONDARY', maxItems: 4, theme: 'warm' }, fields: [
            { fieldKey: 'highlight-1', label: '亮点', sourceType: 'GROUP', sourceId: 'group-highlight', sortOrder: 1, status: 'ACTIVE', display: { valueMode: 'OPTIONS', maxItems: 4 } },
          ] },
          { sectionKey: 'badge', title: '图片角标', displayType: 'TITLE_IMAGE_BADGE', placement: 'LIST_CARD', sortOrder: 3, status: 'ACTIVE', presentation: null, fields: [
            { fieldKey: 'noble-1', label: '贵族', sourceType: 'ATTRIBUTE', sourceId: 'attr-noble', sortOrder: 1, status: 'ACTIVE', display: {} },
          ] },
        ],
      },
    }
    const projected = catalogProductToTitleProduct(product({
      title: '不会被改写的原始标题',
      heroCount: 0,
      skinCount: 0,
      attributeValues: {
        rank: '王者50★', hero_count: 108, skin_count: 312,
        highlight_skins: ['highlight_skins:dragon', 'skin-a'], noble_level: 'noble_level:8',
      },
    }))
    const result = resolveTitle(configured, projected, 'LIST_CARD')
    expect(result.primaryText).toBe('王者50★ · 108英雄 · 312皮肤')
    expect(result.blocks.find((block) => block.key === 'tags')?.pieces.map((piece) => piece.text)).toEqual(['爱丽丝神偷', '神龙摆尾'])
    expect(result.imageBadge?.text).toBe('贵族8')
    expect(projected.title).toBe('不会被改写的原始标题')
  })

  it('keeps an explicitly tagged design fixture independent from an active configured template', () => {
    const configured: TitleDefinition = {
      gameCode: 'wzry',
      attributes: [],
      groups: [],
      template: {
        name: '已生效配置', status: 'ACTIVE', definitionVersion: 'title-v2', sections: [{
          sectionKey: 'configured-primary', title: '配置标题', displayType: 'TITLE_TEXT', placement: 'LIST_CARD', sortOrder: 1, status: 'ACTIVE', presentation: { role: 'PRIMARY' }, fields: [{
            fieldKey: 'configured-platform', label: '区服', sourceType: 'STATIC', staticKey: 'platform', sortOrder: 1, status: 'ACTIVE', display: { prefix: '配置：' },
          }],
        }],
      },
    }
    const fixture = product({
      presentationSource: 'design_fixture',
      displayTitle: '王者50★ · 108英雄 · 312皮肤',
      heroCount: 108,
      skinCount: 312,
      eliteLevel: 'V10',
      tags: ['V10', '倪克斯神谕', '时之魔女'],
      inscriptionFull: true,
    })
    const resolved = resolveCatalogProductTitle(configured, fixture).result

    expect(resolved.primaryText).toBe('王者50★ · 108英雄 · 312皮肤')
    expect(resolved.imageBadge?.text).toBe('贵族10')
    expect(resolved.blocks.find((block) => block.kind === 'tags')?.pieces).toHaveLength(2)
    expect(catalogProductToTitleProduct(fixture).verified).toBeUndefined()
  })

  it('continues applying the active configured template to an ordinary product', () => {
    const configured: TitleDefinition = {
      gameCode: 'wzry',
      attributes: [],
      groups: [],
      template: {
        name: '已生效配置', status: 'ACTIVE', definitionVersion: 'title-v2', sections: [{
          sectionKey: 'configured-primary', title: '配置标题', displayType: 'TITLE_TEXT', placement: 'LIST_CARD', sortOrder: 1, status: 'ACTIVE', presentation: { role: 'PRIMARY' }, fields: [{
            fieldKey: 'configured-platform', label: '区服', sourceType: 'STATIC', staticKey: 'platform', sortOrder: 1, status: 'ACTIVE', display: { prefix: '配置：' },
          }],
        }],
      },
    }
    const resolved = resolveCatalogProductTitle(configured, product()).result

    expect(resolved.primaryText).toBe('配置：安卓QQ')
    expect(resolved.fallback).toBe(false)
  })
})
