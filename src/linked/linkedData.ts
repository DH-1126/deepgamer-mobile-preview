import { useEffect, useState } from 'react'
import type { LinkedGame, LinkedGoods, LinkedPublishSnapshot, LinkedSeller, LinkedState } from '../../../双端演示/src/contract'
import { assetPath } from '../components/assetPath'
import { isLinkedDataMode } from '../runtime/dataMode'
import type { Game, Product } from '../types/catalog'
import type { PublicAttributeValue } from '../types/catalog'
import type { ProductDetail } from '../types/productDetail'

import * as embeddedClient from '../../../双端演示/src/client'
import * as httpOnlyClient from './httpLinkedClient'

// 双通道数据源：嵌在双端演示 iframe 内时走 postMessage 宿主；独立的旧 linked 模式才能走 admin-api。
const embeddedChannel = typeof window !== 'undefined' && window.parent !== window
const linkedSource: typeof embeddedClient = embeddedChannel ? embeddedClient : httpOnlyClient
const linkedRuntimeActive = embeddedChannel || isLinkedDataMode

export const getLinkedConnection = linkedSource.getLinkedConnection
export const getLinkedState = linkedSource.getLinkedState
export const subscribeLinkedState = linkedSource.subscribeLinkedState
export const waitForLinkedState = linkedSource.waitForLinkedState
export const linkedCommand = linkedSource.linkedCommand
export const registerLinkedMedia = linkedSource.registerLinkedMedia
export type { LinkedGame, LinkedGoods, LinkedSeller, LinkedState }

export function useLinkedState() {
  const [snapshot, setSnapshot] = useState<{ state: LinkedState | null; tick: number }>(() => ({ state: linkedRuntimeActive ? getLinkedState() : null, tick: 0 }))
  useEffect(() => {
    if (!linkedRuntimeActive) return undefined
    // tick 保证连接状态变化（如 HTTP 通道断开）也触发重渲染，失败路径 state 恒为 null 会被 React 去重
    const sync = () => setSnapshot((current) => ({ state: getLinkedState(), tick: current.tick + 1 }))
    const unsubscribe = subscribeLinkedState(sync)
    void waitForLinkedState().then((state) => setSnapshot((current) => ({ state, tick: current.tick + 1 }))).catch(sync)
    return unsubscribe
  }, [])
  return snapshot.state
}

/** 当前 linked 数据通道：双端演示 iframe（embedded）或本地 admin-api 只读（http）。 */
export const linkedChannel: 'embedded' | 'http' = embeddedChannel ? 'embedded' : 'http'

const fallbackIcons: Record<string, string> = {
  dwrg: assetPath('assets/home-v2/game-dwrg.png'),
  wzry: assetPath('assets/games/wzry.png'),
  sjzxd: assetPath('assets/games/delta.png'),
}

export function toCatalogGame(game: LinkedGame, saleCount = 0): Game {
  return {
    code: game.code,
    name: game.name,
    description: game.code === 'dwrg' ? '角色 / 珍宝 / 段位' : game.code === 'sjzxd' ? '高战号 / 安全箱 / 近战' : '皮肤 / 贵族 / 全英雄',
    image: game.iconUrl || fallbackIcons[game.code] || fallbackIcons.wzry,
    saleCount,
  }
}

export function isPublicGoods(goods: LinkedGoods) {
  return goods.auditStatus === 'APPROVED' && goods.productStatus === 'ON_SALE'
}

export function hasMeaningfulLinkedAttribute(attributes: Record<string, unknown> | undefined, key: string) {
  if (!attributes || !Object.prototype.hasOwnProperty.call(attributes, key)) return false
  const value = attributes[key]
  if (typeof value === 'string') return Boolean(value.trim())
  if (Array.isArray(value)) return value.length > 0
  return value !== null && value !== undefined
}

export function countMeaningfulLinkedAttributes(
  attributes: Record<string, unknown> | undefined,
  keys: readonly string[],
) {
  return keys.filter((key) => hasMeaningfulLinkedAttribute(attributes, key)).length
}

export function getLinkedPublishSnapshotFields(snapshot: LinkedPublishSnapshot | undefined) {
  return snapshot?.sections.flatMap((section) => section.fields.map((field) => ({ ...field, sectionKey: section.sectionKey, sectionTitle: section.title }))) ?? []
}

function stringAttribute(goods: LinkedGoods, key: string, fallback: string) {
  const value = goods.attributes[key]
  return typeof value === 'string' && value.trim() ? value : fallback
}

function numberAttribute(goods: LinkedGoods, key: string, fallback = 0) {
  const value = goods.attributes[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function booleanAttribute(goods: LinkedGoods, key: string, fallback = false) {
  const value = goods.attributes[key]
  return typeof value === 'boolean' ? value : fallback
}

function publicAttributes(attributes: Record<string, unknown>): Record<string, PublicAttributeValue> {
  return Object.fromEntries(Object.entries(attributes).flatMap(([key, value]) => {
    if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)) return [[key, value as PublicAttributeValue]]
    if (Array.isArray(value) && value.every((item) => item === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof item))) return [[key, value as PublicAttributeValue]]
    return []
  }))
}

export function toCatalogProduct(goods: LinkedGoods): Product {
  const tags = Array.isArray(goods.attributes.tags) ? goods.attributes.tags.filter((value): value is string => typeof value === 'string') : []
  const image = goods.images[0] || fallbackIcons[goods.gameCode] || fallbackIcons.wzry
  return {
    id: goods.id,
    productCode: goods.goodsNo,
    gameCode: goods.gameCode,
    title: goods.title,
    displayTitle: goods.title,
    price: goods.priceFen / 100,
    image,
    tags,
    eliteLevel: stringAttribute(goods, 'eliteLevel', '未填写'),
    skinCount: numberAttribute(goods, 'skinCount'),
    platform: stringAttribute(goods, 'platform', '区服待核验'),
    rank: stringAttribute(goods, 'rank', '段位待核验'),
    realName: stringAttribute(goods, 'realName', '实名状态待核验'),
    secondRealName: booleanAttribute(goods, 'secondRealName'),
    faceCompensation: booleanAttribute(goods, 'faceCompensation'),
    listedAt: Date.parse(goods.updatedAt) || 0,
    heroCount: numberAttribute(goods, 'heroCount'),
    negotiable: booleanAttribute(goods, 'negotiable'),
    verified: booleanAttribute(goods, 'verified'),
    wantCount: numberAttribute(goods, 'wantCount'),
    publishedLabel: '联动演示',
    inscriptionFull: booleanAttribute(goods, 'inscriptionFull'),
    attributeValues: publicAttributes(goods.attributes),
  }
}

export function toProductDetail(goods: LinkedGoods, game: LinkedGame): ProductDetail {
  const product = toCatalogProduct(goods)
  const tags = product.tags.length ? product.tags : ['卖家自助发布']
  const snapshotFields = getLinkedPublishSnapshotFields(goods.publishSnapshot).filter((field) => field.provided)
  const summary = goods.publishSnapshot
    ? snapshotFields.slice(0, 2).map((field) => ({ label: field.label, value: field.displayValue }))
    : [
        typeof goods.attributes.platform === 'string' && goods.attributes.platform.trim() ? { label: '区服', value: goods.attributes.platform } : null,
        typeof goods.attributes.rank === 'string' && goods.attributes.rank.trim() ? { label: '段位', value: goods.attributes.rank } : null,
      ].filter((item): item is { label: string; value: string } => Boolean(item))
  return {
    id: goods.id,
    aliases: [goods.goodsNo],
    productCode: goods.goodsNo,
    gameCode: goods.gameCode,
    gameName: game.name,
    gameIcon: game.iconUrl || fallbackIcons[game.code] || fallbackIcons.wzry,
    title: goods.title,
    displayTitle: goods.title,
    price: goods.priceFen / 100,
    status: goods.productStatus === 'SOLD' ? 'sold' : goods.productStatus === 'ON_SALE' ? 'on_sale' : 'off_shelf',
    platform: product.platform,
    rank: product.rank,
    heroCount: product.heroCount ?? 0,
    skinCount: product.skinCount,
    realName: product.realName,
    secondRealName: product.secondRealName,
    negotiable: product.negotiable ?? false,
    verified: product.verified ?? false,
    wantCount: product.wantCount,
    gallery: goods.images.length ? goods.images : [product.image],
    metrics: [{ label: '游戏', value: game.name }, { label: '商品状态', value: goods.productStatus === 'ON_SALE' ? '在售' : goods.productStatus === 'SOLD' ? '已售' : '已下架' }],
    summary,
    assetCategories: [{ name: '卖家资料', count: tags.length, items: tags }],
    description: goods.description.split(/\n+/).map((line) => line.trim()).filter(Boolean),
    groupName: '联动演示商品',
    groupNumber: goods.auditCaseId,
    guaranteeCovered: ['平台演示审核', '同会话状态联动'],
    guaranteeExcluded: ['真实支付与线上履约未接入'],
    tips: [goods.publishSnapshot ? '此商品来自联动演示动态发布模板' : '此商品来自联动演示基础表单'],
    tags,
    eliteLevel: product.eliteLevel,
    inscriptionFull: product.inscriptionFull,
    attributeValues: publicAttributes(goods.attributes),
    linkedPublishSnapshot: goods.publishSnapshot,
  }
}


/** HTTP 联动：后台回收商 → 用户端 Recycler 展示形状（演示级依托）。 */
export function toRecyclerOptions(recyclers: NonNullable<LinkedState['recyclers']>): Array<{
  id: string; name: string; mark: string; availability: 'online' | 'offline';
  serviceTime: string; description: string; tags: string[]; supportedGames: string[];
}> {
  return recyclers.map((recycler) => ({
    id: recycler.id,
    name: recycler.displayName,
    mark: recycler.displayName.slice(0, 1),
    availability: recycler.status === 'cooperating' && recycler.acceptingNow ? 'online' : 'offline',
    serviceTime: recycler.delayHint || '服务时间以后台配置为准',
    description: recycler.introduction || '暂无介绍',
    tags: recycler.certificationTags,
    supportedGames: recycler.gameCodes,
  }))
}

/** HTTP 联动：快照卖家（商品的用户依托）。 */
export function getLinkedUsers(state: LinkedState | null) {
  return state?.users ?? []
}

/** HTTP 联动：后台回收商列表。 */
export function getLinkedRecyclers(state: LinkedState | null) {
  return state?.recyclers ?? []
}
