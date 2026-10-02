import type { LinkedGame, LinkedGoods } from '../../../双端演示/src/contract'

/** 后台 admin-api 返回的原始形状（仅声明本映射用到的字段）。 */
export type AdminGameRow = {
  id: string
  code: string
  name: string
  status: string
  rowVersion: number
  iconPath?: string | null
  iconUrl?: string | null
  sortOrder: number
}

export type AdminGoodsDetail = {
  id: string
  goodsNo: string
  title: string
  priceFen: number
  description?: string | null
  productStatus?: string | null
  auditStatus?: string | null
  rowVersion?: number | null
  createdAt?: string | null
  updatedAt?: string | null
  game?: { id?: string; code?: string; name?: string; iconUrl?: string | null } | null
  seller?: { sellerRef?: string; displayName?: string } | null
  sections?: Array<{ sectionKey?: string; fields?: Array<{ fieldKey?: string; label?: string; value?: unknown; displayValue?: string }> }> | null
  media?: Array<{ assetId?: string; url?: string }> | null
  orderLock?: { locked?: boolean } | null
}

/** 契约 GameCode 是封闭联合；后台出现未收录游戏时跳过并在快照说明，而不是伪造。 */
const SUPPORTED_GAME_CODES: ReadonlySet<string> = new Set(['dwrg', 'wzry', 'sjzxd', 'hpjy', 'lol', 'ys', 'valorant'])

export function toLinkedGames(rows: readonly AdminGameRow[]): { games: LinkedGame[]; skipped: string[] } {
  const games: LinkedGame[] = []
  const skipped: string[] = []
  for (const row of rows) {
    if (!SUPPORTED_GAME_CODES.has(row.code)) { skipped.push(row.code); continue }
    games.push({
      id: row.id,
      code: row.code as LinkedGame['code'],
      name: row.name,
      status: row.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
      rowVersion: row.rowVersion,
      iconUrl: row.iconUrl ?? row.iconPath ?? null,
      sortOrder: row.sortOrder,
    })
  }
  return { games, skipped }
}

/**
 * 发布模板分区字段摊平为 attributes，与双端演示 LinkedGoods.attributes 约定一致。
 * nameToKey 提供后台属性 name（中文名）→ logicalKey 的映射：命中时以 logicalKey 为键，
 * 使商品属性能被标题模板的 fieldKey（logicalKey）解析，激活列表标题块与详情核心指标。
 */
/** 原型消费的英文属性键（toCatalogProduct/toProductDetail 读取），按后台中文标签对齐。 */
const PROTOTYPE_ATTRIBUTE_KEYS: Readonly<Record<string, string>> = {
  '贵族等级': 'eliteLevel', '段位': 'rank', '皮肤数量': 'skinCount', '英雄数量': 'heroCount',
  '实名状态': 'realName', '可二次实名': 'secondRealName', '找回包赔': 'faceCompensation', '平台/大区': 'platform',
}

const BOOLEAN_LABEL_KEYS = new Set(['secondRealName', 'faceCompensation'])
const NUMBER_LABEL_KEYS = new Set(['skinCount', 'heroCount'])

function normalizeAttributeValue(key: string, raw: unknown): unknown {
  if (typeof raw !== 'string') return raw
  if (BOOLEAN_LABEL_KEYS.has(key)) return raw.trim() === '是' || raw.trim() === 'true'
  if (NUMBER_LABEL_KEYS.has(key)) { const parsed = Number(raw); return Number.isFinite(parsed) ? parsed : raw }
  return raw
}

export function flattenSections(sections: AdminGoodsDetail['sections'], nameToKey: Readonly<Record<string, string>> = {}): Record<string, unknown> {
  const attributes: Record<string, unknown> = {}
  for (const section of sections ?? []) {
    for (const field of section?.fields ?? []) {
      if (!field?.fieldKey) continue
      const label = field.label?.trim() ?? ''
      const raw = field.value ?? field.displayValue ?? ''
      // 优先写原型英文键（激活指标/交易信息），同时保留标题模板的 logicalKey 键（激活标题块）
      const prototypeKey = PROTOTYPE_ATTRIBUTE_KEYS[label]
      if (prototypeKey) attributes[prototypeKey] = normalizeAttributeValue(prototypeKey, raw)
      const key = nameToKey[label] ?? field.fieldKey
      if (!(key in attributes)) attributes[key] = raw
    }
  }
  return attributes
}

const PRODUCT_STATUS: ReadonlySet<string> = new Set(['ON_SALE', 'OFF_SHELF', 'SOLD'])
const AUDIT_STATUS: ReadonlySet<string> = new Set(['NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED', 'NEEDS_MORE_INFO'])

export function toLinkedGoods(detail: AdminGoodsDetail, fallbackGameCode: string, fallbackSellerRef: string, fallbackSellerName: string, nameToKey: Readonly<Record<string, string>> = {}): LinkedGoods | null {
  const gameCode = detail.game?.code ?? fallbackGameCode
  if (!SUPPORTED_GAME_CODES.has(gameCode)) return null
  const productStatus = PRODUCT_STATUS.has(detail.productStatus ?? '') ? detail.productStatus as LinkedGoods['productStatus'] : 'OFF_SHELF'
  const auditStatus = AUDIT_STATUS.has(detail.auditStatus ?? '') ? detail.auditStatus as LinkedGoods['auditStatus'] : 'NOT_SUBMITTED'
  return {
    id: detail.id,
    goodsNo: detail.goodsNo,
    gameCode: gameCode as LinkedGoods['gameCode'],
    sellerId: detail.seller?.sellerRef ?? fallbackSellerRef,
    sellerName: detail.seller?.displayName ?? fallbackSellerName,
    title: detail.title,
    priceFen: Number.isFinite(detail.priceFen) ? Math.max(0, Math.round(detail.priceFen)) : 0,
    description: detail.description ?? '',
    images: (detail.media ?? []).map((item) => item.url).filter((url): url is string => Boolean(url)),
    mediaIds: (detail.media ?? []).map((item) => item.assetId).filter((id): id is string => Boolean(id)),
    attributes: flattenSections(detail.sections, nameToKey),
    groupSelections: {},
    productStatus,
    auditStatus,
    rowVersion: detail.rowVersion ?? 1,
    auditVersion: detail.rowVersion ?? 1,
    auditCaseId: '',
    submissionNo: 0,
    reviewReason: '',
    createdAt: detail.createdAt ?? new Date().toISOString(),
    updatedAt: detail.updatedAt ?? detail.createdAt ?? new Date().toISOString(),
    submittedAt: detail.createdAt ?? new Date().toISOString(),
    locked: Boolean(detail.orderLock?.locked),
    source: 'BASELINE',
  }
}
