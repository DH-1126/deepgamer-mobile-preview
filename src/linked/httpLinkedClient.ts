import { LinkedError, type LinkedCommandName, type LinkedGoods, type LinkedMedia, type LinkedRecycler, type LinkedState, type LinkedTitleConfig, type LinkedTitleRevision, type LinkedUser } from '../../../双端演示/src/contract'
import { publicTitleDefinition, titleDefinitionHash } from '../../../双端演示/src/title-config'
import { publishDefinitionHash } from '../../../双端演示/src/publish-config'
import { detailDefinitionHash } from '../../../双端演示/src/detail-config'
import { searchDefinitionHash } from '../../../双端演示/src/search-config'
import type { LinkedDetailConfig, LinkedDetailRevision, LinkedPublishConfig, LinkedPublishRevision, LinkedSearchConfig, LinkedSearchRevision } from '../../../双端演示/src/contract'
import { seedLinkedOrders, type AdminOrderRow } from './linkedOrderSync'
import { seedLinkedConversations } from './linkedMessageSync'
import { toLinkedGames, toLinkedGoods, type AdminGameRow, type AdminGoodsDetail } from './linkedHttpMapping'
import { isLinkedDataMode } from '../runtime/dataMode'

/**
 * 独立运行（非双端演示 iframe 内）时的 linked 数据源：
 * 直接从本地 admin-api（经 vite dev 代理）拉取只读快照。
 * - 静态数据：admin-api 种子（games / goods）
 * - 短期数据：本模块内存中的快照与 API 会话 cookie，刷新即重新拉取
 * - 写命令一律拒绝（批次 1 只读），写演示仍走双端演示入口
 */

const API_BASE = '/api/v1'
const READ_ONLY_COMMAND_DETAIL = 'HTTP 联动通道暂未支持该操作；发布、审核等完整写演示请从双端演示入口进行'

/** 本次页面会话的写凭据（csrfToken 与会话 cookie 同生命周期，仅内存，不落任何存储） */
let csrfToken: string | null = null

type Connection = { status: 'connecting' | 'connected' | 'disconnected'; error: string | null }

const INACTIVE_DETAIL = '旧 HTTP 联动客户端仅允许在 linked 模式使用'
const inactiveConnection: Connection = { status: 'disconnected', error: INACTIVE_DETAIL }

function requireLegacyLinkedMode() {
  if (!isLinkedDataMode) throw new LinkedError(503, 'LINKED_MODE_INACTIVE', INACTIVE_DETAIL)
}

function canAutoStart() {
  return isLinkedDataMode && typeof window !== 'undefined'
}

let state: LinkedState | null = null
let connection: Connection = { status: 'connecting', error: null }
let loading: Promise<LinkedState> | null = null
const listeners = new Set<() => void>()

function notify() { listeners.forEach((listener) => listener()) }
function setConnection(status: Connection['status'], error: string | null = null) {
  if (connection.status === status && connection.error === error) return
  connection = { status, error }
  notify()
}

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value) }
  return value
}

async function apiFetch<T>(path: string): Promise<T> {
  requireLegacyLinkedMode()
  const response = await fetch(`${API_BASE}${path}`, { credentials: 'same-origin', headers: { accept: 'application/json' } })
  if (response.status === 401) throw new LinkedError(401, 'LINKED_UNAUTHORIZED', '后台会话未登录或已过期，请刷新页面重新连接')
  if (!response.ok) throw new LinkedError(response.status, 'LINKED_HTTP_ERROR', `后台接口请求失败（${response.status}）`)
  const payload = (await response.json()) as { data?: T }
  return (payload.data ?? (payload as unknown)) as T
}

async function ensureLogin(): Promise<void> {
  requireLegacyLinkedMode()
  const probe = await fetch(`${API_BASE}/game-management/games?page=1&pageSize=1`, { credentials: 'same-origin', headers: { accept: 'application/json' } })
  // 会话 cookie 有效且写凭据已就绪才跳过登录；csrfToken 缺失时仍需登录一次（幂等）获取
  if (probe.ok && csrfToken) return
  if (!probe.ok && probe.status !== 401) return
  const login = await fetch('/linked-api/login', { method: 'POST', credentials: 'same-origin' })
  if (!login.ok) throw new LinkedError(502, 'LINKED_LOGIN_FAILED', '演示后台登录失败，请确认本地 admin-api 服务与凭据配置')
  const loginBody = (await login.json().catch(() => ({}))) as { data?: { csrfToken?: string } }
  csrfToken = loginBody.data?.csrfToken ?? null
}

/** 后台写请求：统一携带 CSRF 头与幂等键（后台对写操作强制两者） */
async function apiWrite<T>(path: string, body: Record<string, unknown>, idempotencyKey: string): Promise<T> {
  requireLegacyLinkedMode()
  if (!csrfToken) throw new LinkedError(412, 'LINKED_CSRF_MISSING', '写凭据未就绪，请刷新页面后重试')
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken, 'idempotency-key': idempotencyKey },
    body: JSON.stringify(body),
  })
  if (response.status === 401) throw new LinkedError(401, 'LINKED_UNAUTHORIZED', '后台会话未登录或已过期，请刷新页面重新连接')
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new LinkedError(response.status, 'LINKED_HTTP_ERROR', problem?.detail ?? `后台写操作失败（${response.status}）`)
  }
  const payload = (await response.json()) as { data?: T }
  return (payload.data ?? (payload as unknown)) as T
}

async function fetchAllGoodsListRows(): Promise<GoodsListRow[]> {
  const pageSize = 50
  const rows: GoodsListRow[] = []
  for (let page = 1; page <= 20; page++) {
    const batch = await apiFetch<GoodsListRow[]>(`/goods-management/goods?page=${page}&pageSize=${pageSize}`)
    rows.push(...(batch ?? []))
    if (!Array.isArray(batch) || batch.length < pageSize) break
  }
  return rows
}

/** 最近一次商品列表行（供卖家聚合复用，随快照生命周期重置）。 */
let listRowsCache: GoodsListRow[] = []

async function fetchGoodsDetails(_ids: readonly string[]): Promise<Array<{ detail: AdminGoodsDetail; fallbackGameCode: string; fallbackSellerRef: string; fallbackSellerName: string }>> {
  const list = await fetchAllGoodsListRows()
  listRowsCache = list
  const metaById = new Map(list.map((row) => [row.id, row]))
  const results: Array<{ detail: AdminGoodsDetail; fallbackGameCode: string; fallbackSellerRef: string; fallbackSellerName: string }> = []
  const queue = list.map((row) => row.id)
  const CONCURRENCY = 6
  let cursor = 0
  const worker = async () => {
    while (cursor < queue.length) {
      const id = queue[cursor++]
      try {
        const detail = await apiFetch<AdminGoodsDetail>(`/goods-management/goods/${encodeURIComponent(id)}`)
        const meta = metaById.get(id)
        results.push({ detail, fallbackGameCode: meta?.game?.code ?? 'wzry', fallbackSellerRef: meta?.seller?.sellerRef ?? 'unknown', fallbackSellerName: meta?.seller?.displayName ?? '演示卖家' })
      } catch { /* 单个商品失败跳过，快照整体降级 */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))
  return results
}

type AdminConfigVersion = { id: string; gameId: string; versionNo: number; state: 'DRAFT' | 'PUBLISHED' | 'RETIRED'; baseVersionId: string | null; schemaVersion: number; schemaHash: string | null; changeSummary: string; rowVersion: number; createdAt: string; publishedAt?: string | null }

/** 拉取各游戏 PUBLISHED 配置版本，组装契约四套配置（TITLE/PUBLISH/DETAIL/SEARCH）；同时产出属性中文名 → logicalKey 映射供商品属性对齐。 */
async function fetchGameConfigs(games: readonly { id: string; code: string }[]): Promise<{ titleConfigs: LinkedTitleConfig[]; publishConfigs: LinkedPublishConfig[]; detailConfigs: LinkedDetailConfig[]; searchConfigs: LinkedSearchConfig[]; nameToKeyByGame: Record<string, Record<string, string>> }> {
  const configs: LinkedTitleConfig[] = []
  const publishConfigs: LinkedPublishConfig[] = []
  const detailConfigs: LinkedDetailConfig[] = []
  const searchConfigs: LinkedSearchConfig[] = []
  const nameToKeyByGame: Record<string, Record<string, string>> = {}
  for (const game of games) {
    try {
      const versions = await apiFetch<AdminConfigVersion[]>(`/game-management/games/${encodeURIComponent(game.id)}/config-versions`)
      const published = (versions ?? []).filter((version) => version.state === 'PUBLISHED').sort((a, b) => b.versionNo - a.versionNo)[0]
      if (!published) continue
      const [templatePayload, attributesPayload, groupsPayload, templatesPayload, searchFieldsPayload] = await Promise.all([
        apiFetch<{ template: LinkedTitleRevision['template'] | null }>(`/game-management/games/${encodeURIComponent(game.id)}/config-versions/${encodeURIComponent(published.id)}/title-template`),
        apiFetch<{ rows?: Array<LinkedTitleRevision['attributes'][number]> }>(`/game-management/games/${encodeURIComponent(game.id)}/config-versions/${encodeURIComponent(published.id)}/attributes`),
        apiFetch<{ rows?: LinkedTitleRevision['groups'] }>(`/game-management/games/${encodeURIComponent(game.id)}/config-versions/${encodeURIComponent(published.id)}/groups`),
        apiFetch<{ rows?: Array<LinkedTitleRevision['template']> }>(`/game-management/games/${encodeURIComponent(game.id)}/config-versions/${encodeURIComponent(published.id)}/templates`),
        apiFetch<{ rows?: LinkedSearchRevision['rows'] }>(`/game-management/games/${encodeURIComponent(game.id)}/config-versions/${encodeURIComponent(published.id)}/search-fields`),
      ])
      const attributes = attributesPayload?.rows ?? []
      const groups = groupsPayload?.rows ?? []
      const allTemplates = templatesPayload?.rows ?? []
      if (!templatePayload?.template || attributes.length === 0) continue
      // 发布模板：PUBLISH 类型（同版本）
      const publishTemplate = allTemplates.find((tpl) => tpl.templateType === 'PUBLISH' && tpl.status === 'ACTIVE')
      if (publishTemplate) {
        const revision: LinkedPublishRevision = {
          ...published, publishedAt: published.publishedAt ?? null,
          gameCode: game.code as LinkedPublishRevision['gameCode'], scope: 'PUBLISH',
          baseConfigVersionId: published.baseVersionId ?? published.id, source: 'BASELINE_CAPTURE',
          template: publishTemplate, attributes, groups,
        }
        revision.schemaHash = publishDefinitionHash(revision)
        publishConfigs.push({ gameId: game.id, gameCode: revision.gameCode, publishedRevisionId: published.id, draftRevisionId: null, nextVersionNo: published.versionNo + 1, revisions: [revision] })
      }
      // 详情模板：DETAIL 类型（同版本）
      const detailTemplate = allTemplates.find((tpl) => tpl.templateType === 'DETAIL' && tpl.status === 'ACTIVE')
      if (detailTemplate) {
        const revision: LinkedDetailRevision = {
          ...published, publishedAt: published.publishedAt ?? null,
          gameCode: game.code as LinkedDetailRevision['gameCode'], scope: 'DETAIL',
          baseConfigVersionId: published.baseVersionId ?? published.id, source: 'BASELINE_CAPTURE',
          template: detailTemplate, attributes, groups,
        }
        revision.schemaHash = detailDefinitionHash(revision)
        detailConfigs.push({ gameId: game.id, gameCode: revision.gameCode, publishedRevisionId: published.id, draftRevisionId: null, nextVersionNo: published.versionNo + 1, revisions: [revision] })
      }
      // 搜索配置：search-fields 行（同版本；与发布模板同基线）
      // display 元数据仅保留消费方认可的 provenance/unresolvedReference 键（后台 sourceGame 等额外键会被筛选校验拒绝）
      const searchRows: LinkedSearchRevision['rows'] = (searchFieldsPayload?.rows ?? []).filter((row) => row.status === 'ACTIVE').map((row) => {
        const display = row.display as Record<string, unknown> | null | undefined
        const kept = display ? Object.fromEntries(Object.entries(display).filter(([key]) => key === 'provenance' || key === 'unresolvedReference')) : {}
        return { ...row, display: Object.keys(kept).length ? kept : undefined } as LinkedSearchRevision['rows'][number]
      })
      if (searchRows.length) {
        const revision: LinkedSearchRevision = {
          ...published, publishedAt: published.publishedAt ?? null,
          gameCode: game.code as LinkedSearchRevision['gameCode'], scope: 'SEARCH',
          baseConfigVersionId: published.baseVersionId ?? published.id, sourceConfigSchemaHash: null,
          source: 'BASELINE_CAPTURE', rows: searchRows, attributes, groups,
        }
        revision.schemaHash = searchDefinitionHash(revision)
        searchConfigs.push({ gameId: game.id, gameCode: revision.gameCode, publishedRevisionId: published.id, draftRevisionId: null, nextVersionNo: published.versionNo + 1, revisions: [revision] })
      }
      const revision: LinkedTitleRevision = {
        ...published, publishedAt: published.publishedAt ?? null,
        gameCode: game.code as LinkedTitleRevision['gameCode'], scope: 'TITLE',
        baseConfigVersionId: published.baseVersionId ?? published.id, source: 'BASELINE_CAPTURE',
        template: templatePayload.template, attributes, groups,
      }
      revision.schemaHash = titleDefinitionHash(publicTitleDefinition(revision))
      configs.push({ gameId: game.id, gameCode: revision.gameCode, publishedRevisionId: published.id, draftRevisionId: null, nextVersionNo: published.versionNo + 1, revisions: [revision] })
      const mapping = Object.fromEntries(attributes.map((attribute) => [attribute.name, attribute.logicalKey]))
      // 后台商品公共字段 label 为“平台/大区”，模板的区服字段引用“区服”属性的 logicalKey，补别名对齐
      if (mapping['区服']) mapping['平台/大区'] = mapping['区服']
      nameToKeyByGame[game.code] = mapping
    } catch { /* 单游戏配置缺失时跳过，不影响商品目录 */ }
  }
  return { titleConfigs: configs, publishConfigs, detailConfigs, searchConfigs, nameToKeyByGame }
}

type GoodsListRow = { id: string; game?: { code?: string }; seller?: { sellerRef?: string; displayName?: string; mobileMasked?: string | null } }

/** 从商品列表行聚合真实卖家（商品的用户依托）。 */
function aggregateSellers(rows: readonly GoodsListRow[]): LinkedUser[] {
  const byId = new Map<string, LinkedUser>()
  for (const row of rows) {
    const id = row.seller?.sellerRef
    if (!id) continue
    const existing = byId.get(id)
    if (existing) { existing.goodsCount += 1; continue }
    byId.set(id, { id, name: row.seller?.displayName ?? id, mobileMasked: row.seller?.mobileMasked ?? null, roles: ['seller'], creditLevel: null, goodsCount: 1 })
  }
  return [...byId.values()].sort((a, b) => b.goodsCount - a.goodsCount)
}

type AdminRecyclerRow = {
  recycler_id: string; display_name: string; introduction?: string | null;
  certification_tags?: string[]; welcome_message?: string | null; quick_phrases?: string[];
  accepting_now?: boolean; delay_hint?: string | null; status?: string;
  supported_games?: Array<{ game_code?: string; enabled?: boolean }>; sort_order?: number;
}

/** 拉取后台回收商（演示级依托；端点为读取性质 POST）。 */
async function fetchRecyclers(): Promise<LinkedRecycler[]> {
  try {
    const payload = await apiWrite<{ list?: AdminRecyclerRow[] }>('/ops/recycle/recycler/list', {}, 'linked-recycler-list')
    return (payload?.list ?? []).map((row) => ({
      id: row.recycler_id,
      displayName: row.display_name,
      introduction: row.introduction ?? '',
      certificationTags: row.certification_tags ?? [],
      welcomeMessage: row.welcome_message ?? '',
      quickPhrases: row.quick_phrases ?? [],
      acceptingNow: Boolean(row.accepting_now),
      delayHint: row.delay_hint ?? '',
      status: (row.status === 'paused' ? 'paused' : row.status === 'disabled' ? 'disabled' : 'cooperating') as LinkedRecycler['status'],
      gameCodes: (row.supported_games ?? []).filter((game) => game.enabled !== false).map((game) => String(game.game_code ?? '')).filter(Boolean),
      sortOrder: row.sort_order ?? 0,
    })).sort((a, b) => a.sortOrder - b.sortOrder)
  } catch { /* 回收商拉取失败不阻断商品目录 */ return [] }
}

async function loadState(): Promise<LinkedState> {
  setConnection('connecting')
  await ensureLogin()
  const gameRows: AdminGameRow[] = []
  for (let page = 1; page <= 10; page++) {
    const batch = await apiFetch<AdminGameRow[]>(`/game-management/games?page=${page}&pageSize=50`)
    gameRows.push(...(batch ?? []))
    if (!Array.isArray(batch) || batch.length < 50) break
  }
  const { games, skipped } = toLinkedGames(gameRows ?? [])
  const [gameConfigs, details, recyclers, adminOrders] = await Promise.all([
    fetchGameConfigs(games), fetchGoodsDetails([]), fetchRecyclers(),
    apiFetch<AdminOrderRow[]>('/order-management/orders?page=1&pageSize=50').catch(() => [] as AdminOrderRow[]),
  ])
  const { titleConfigs, publishConfigs, detailConfigs, searchConfigs, nameToKeyByGame } = gameConfigs
  // 订单以买卖双视角灌入内存仓库；订单页组件按既有订阅自动刷新
  if (adminOrders.length) seedLinkedOrders(adminOrders)
  // 消息会话与记录灌入内存仓库（读通路；发送仍为本地演示）
  await seedLinkedConversations((path) => apiFetch<unknown>(path)).catch(() => undefined)
  const goods = details
    .map(({ detail, fallbackGameCode, fallbackSellerRef, fallbackSellerName }) => toLinkedGoods(detail, fallbackGameCode, fallbackSellerRef, fallbackSellerName, nameToKeyByGame[detail.game?.code ?? fallbackGameCode] ?? {}))
    .filter((item): item is LinkedGoods => item !== null)
  // 演示卖家视角优先对齐“审核通过且在售”商品的卖家，保证我的商品列表与专区展示同一主线
  const featured = goods.find((item) => item.auditStatus === 'APPROVED' && item.productStatus === 'ON_SALE') ?? goods[0]
  const sellerRef = featured?.sellerId ?? 'http-demo-seller'
  const sellerName = featured?.sellerName ?? '演示卖家'
  // 用户依托：商品卖家 + 订单买卖家聚合（订单引用已经对齐脚本指向 business_client_users 真实用户）
  const orderUsers: LinkedUser[] = adminOrders.flatMap((order) => [
    { id: order.buyer?.userRef ?? '', name: order.buyer?.displayName ?? '', mobileMasked: order.buyer?.mobileMasked ?? null, roles: ['buyer'] as Array<'buyer'>, creditLevel: null, goodsCount: 0 },
    { id: order.seller?.userRef ?? '', name: order.seller?.displayName ?? '', mobileMasked: order.seller?.mobileMasked ?? null, roles: ['seller'] as Array<'seller'>, creditLevel: null, goodsCount: 0 },
  ]).filter((user) => user.id && user.name)
  const mergedUsers = new Map<string, LinkedUser>()
  for (const user of [...aggregateSellers(listRowsCache), ...orderUsers]) {
    const existing = mergedUsers.get(user.id)
    if (existing) {
      existing.roles = [...new Set([...existing.roles, ...user.roles])] as LinkedUser['roles']
      existing.goodsCount += user.goodsCount
    } else mergedUsers.set(user.id, { ...user })
  }
  const users = [...mergedUsers.values()]
  const currentSeller = users.find((user) => user.id === sellerRef)
  const sessionId = `http-${crypto.randomUUID()}`
  state = freeze({
    sessionId,
    revision: 1,
    games,
    goods,
    seller: {
      id: sellerRef, displayName: sellerName, status: 'NONE', contractStatus: 'UNSIGNED',
      rowVersion: 1, application: null, applicationId: null, reviewReason: '', submittedAt: null, reviewedAt: null,
    },
    media: {},
    titleConfigs,
    users,
    recyclers,
    publishConfigs,
    detailConfigs,
    searchConfigs,
  })
  setConnection('connected')
  notify()
  if (skipped.length) console.info(`[linked-http] 跳过未收录游戏：${[...new Set(skipped)].join(', ')}`)
  return state
}

function start(): Promise<LinkedState> {
  requireLegacyLinkedMode()
  // 与 postMessage 客户端一致：非浏览器环境（测试/SSR）静默不加载，避免无谓的网络请求与未处理拒绝
  if (typeof window === 'undefined') return Promise.reject(new LinkedError(503, 'LINKED_DISCONNECTED', 'HTTP 联动仅在浏览器环境可用'))
  if (state && connection.status === 'connected') return Promise.resolve(state)
  if (!loading) {
    loading = loadState()
      .catch((error) => {
        const detail = error instanceof LinkedError ? error.detail : '未连接到本地后台接口，请确认 admin-api（8780）已启动'
        setConnection('disconnected', detail)
        throw error instanceof LinkedError ? error : new LinkedError(503, 'LINKED_DISCONNECTED', detail)
      })
      .finally(() => { loading = null })
  }
  return loading
}

export function getLinkedState(): LinkedState | null { if (canAutoStart()) start().catch(() => undefined); return state }
export function getLinkedConnection(): Connection { if (!isLinkedDataMode) return inactiveConnection; if (canAutoStart()) start().catch(() => undefined); return connection }
export function subscribeLinkedState(listener: () => void): () => void { listeners.add(listener); if (canAutoStart()) start().catch(() => undefined); return () => listeners.delete(listener) }

export async function waitForLinkedState(timeoutMs = 8_000): Promise<LinkedState> {
  requireLegacyLinkedMode()
  if (typeof window === 'undefined') throw new LinkedError(503, 'LINKED_DISCONNECTED', 'HTTP 联动仅在浏览器环境可用')
  if (state && connection.status === 'connected') return state
  if (connection.status === 'disconnected') throw new LinkedError(503, 'LINKED_DISCONNECTED', connection.error ?? '未连接到本地后台接口')
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { stop(); setConnection('disconnected', '连接本地后台超时'); reject(new LinkedError(503, 'LINKED_TIMEOUT', '连接本地后台超时，请确认服务已启动')) }, timeoutMs)
    const stop = subscribeLinkedState(() => {
      if (state && connection.status === 'connected') { clearTimeout(timer); stop(); resolve(state) }
      else if (connection.status === 'disconnected') { clearTimeout(timer); stop(); reject(new LinkedError(503, 'LINKED_DISCONNECTED', connection.error ?? '连接中断')) }
    })
  })
}

type LinkedCommandOptions = { expectedVersion?: number; requestId?: string; sessionId?: string }

async function reloadState(): Promise<LinkedState> {
  // 写操作后重新拉取后台快照：新 sessionId 让消费方按协议重置本地基线
  state = null
  listRowsCache = []
  return start()
}

export async function linkedCommand<T = unknown>(command: LinkedCommandName, payload: Record<string, unknown>, options: LinkedCommandOptions = {}): Promise<T> {
  const current = await waitForLinkedState()
  if (command === 'GOODS_OFF_SHELF') {
    const goodsId = String(payload.goodsId ?? '')
    const reason = String(payload.reason ?? '')
    if (!goodsId) throw new LinkedError(422, 'GOODS_TARGET_MISSING', '缺少要下架的商品')
    if (reason.trim().length < 2) throw new LinkedError(422, 'GOODS_REASON_TOO_SHORT', '下架原因至少 2 个字符')
    const rowVersion = options.expectedVersion ?? current.goods.find((item) => item.id === goodsId)?.rowVersion
    if (!rowVersion) throw new LinkedError(409, 'GOODS_NOT_FOUND', '未在当前快照中找到该商品，请刷新后重试')
    const result = await apiWrite<unknown>(`/goods-management/goods/${encodeURIComponent(goodsId)}/off-shelf`, { rowVersion, reason }, options.requestId ?? crypto.randomUUID())
    await reloadState()
    return result as T
  }
  throw new LinkedError(501, 'LINKED_COMMAND_UNSUPPORTED', READ_ONLY_COMMAND_DETAIL)
}

export async function registerLinkedMedia(_file: File): Promise<LinkedMedia> {
  await waitForLinkedState()
  throw new LinkedError(501, 'LINKED_COMMAND_UNSUPPORTED', READ_ONLY_COMMAND_DETAIL)
}

/** HTTP 联动：向后台会话发送文本消息（真实落库）。403 未接管时自动 takeover 后重试一次。 */
export async function sendLinkedImText(conversationId: string, content: string): Promise<{ ok: true; id: string; senderName: string; createdAt: string } | { ok: false; detail: string }> {
  try {
    await ensureLogin()
    const detail = await apiFetch<{ rowVersion?: number }>(`/im/conversations/${encodeURIComponent(conversationId)}`)
    const rowVersion = detail?.rowVersion ?? 1
    const send = (version: number) => apiWrite<{ id: string; senderName?: string | null; createdAt?: string }>(
      `/im/conversations/${encodeURIComponent(conversationId)}/messages`,
      { rowVersion: version, clientMessageId: crypto.randomUUID(), messageType: 'TEXT', content },
      `linked-im-${crypto.randomUUID()}`,
    )
    try {
      const sent = await send(rowVersion)
      return { ok: true, id: sent.id, senderName: sent.senderName ?? '', createdAt: sent.createdAt ?? new Date().toISOString() }
    } catch (error) {
      if (!(error instanceof LinkedError) || (error.code !== 'LINKED_HTTP_ERROR' && error.status !== 403)) throw error
      // 未接管（IM_NOT_OWNER / IM_ALREADY_TAKEN 场景外的 403）：接管后重试一次
      await apiWrite(`/im/conversations/${encodeURIComponent(conversationId)}/takeover`, { rowVersion, reason: '用户端联动演示发送' }, `linked-takeover-${crypto.randomUUID()}`)
      const sent = await send(rowVersion)
      return { ok: true, id: sent.id, senderName: sent.senderName ?? '', createdAt: sent.createdAt ?? new Date().toISOString() }
    }
  } catch (error) {
    return { ok: false, detail: error instanceof LinkedError ? error.detail : '后台发送失败，请重试' }
  }
}

export function linkedProblem(error: unknown): { status: number; code: string; detail: string } {
  return error instanceof LinkedError
    ? { status: error.status, code: error.code, detail: error.detail }
    : { status: 500, code: 'LINKED_ERROR', detail: error instanceof Error ? error.message : '联动操作失败' }
}

// ─── C 端订单演示写路径（2026-09-23）─────────────────────────────────────────
// 对应 admin-api /client/orders：下单/支付/取消/确认放款/售后申请。
// rowVersion 由调用方在最新订单行上读取；写完统一由调用方刷新订单快照。

// 与 /order-management/orders 列表项同构（也是 linkedOrderSync.AdminOrderRow 的子集），
// 因此操作编排取到的行可直接回灌 seedLinkedOrders。
export interface LinkedClientOrderRow {
  id: string
  orderNo: string
  status: string
  rowVersion: number
  amountFen: number
  buyer?: { userRef?: string; displayName?: string }
  seller?: { userRef?: string }
}

export type LinkedClientActionResult =
  | { ok: true; order: LinkedClientOrderRow; aftersaleCaseNo?: string | null }
  | { ok: false; detail: string }

function clientOrderError(error: unknown): string {
  if (error instanceof LinkedError) return error.detail
  return error instanceof Error ? error.message : '订单操作失败，请重试'
}

export async function createLinkedOrder(goodsId: string, buyerUserRef: string, remark?: string): Promise<LinkedClientActionResult> {
  try {
    await ensureLogin()
    const result = await apiWrite<{ order: LinkedClientOrderRow }>(
      '/client/orders',
      { goodsId, buyerUserRef, ...(remark ? { remark } : {}) },
      `linked-order-create-${crypto.randomUUID()}`,
    )
    return { ok: true, order: result.order }
  } catch (error) { return { ok: false, detail: clientOrderError(error) } }
}

export async function payLinkedOrder(orderId: string, buyerUserRef: string, rowVersion: number, channel: 'WECHAT' | 'ALIPAY' | 'BALANCE' = 'WECHAT'): Promise<LinkedClientActionResult> {
  try {
    await ensureLogin()
    const result = await apiWrite<{ order: LinkedClientOrderRow }>(
      `/client/orders/${encodeURIComponent(orderId)}/pay`,
      { buyerUserRef, rowVersion, channel },
      `linked-order-pay-${crypto.randomUUID()}`,
    )
    return { ok: true, order: result.order }
  } catch (error) { return { ok: false, detail: clientOrderError(error) } }
}

export async function cancelLinkedOrder(orderId: string, actorUserRef: string, actorRole: 'BUYER' | 'SELLER', rowVersion: number, reason: string): Promise<LinkedClientActionResult> {
  try {
    await ensureLogin()
    const result = await apiWrite<{ order: LinkedClientOrderRow }>(
      `/client/orders/${encodeURIComponent(orderId)}/cancel`,
      { actorUserRef, actorRole, rowVersion, reason },
      `linked-order-cancel-${crypto.randomUUID()}`,
    )
    return { ok: true, order: result.order }
  } catch (error) { return { ok: false, detail: clientOrderError(error) } }
}

export async function confirmReleaseLinkedOrder(orderId: string, buyerUserRef: string, rowVersion: number): Promise<LinkedClientActionResult> {
  try {
    await ensureLogin()
    const result = await apiWrite<{ order: LinkedClientOrderRow }>(
      `/client/orders/${encodeURIComponent(orderId)}/confirm-release`,
      { buyerUserRef, rowVersion },
      `linked-order-release-${crypto.randomUUID()}`,
    )
    return { ok: true, order: result.order }
  } catch (error) { return { ok: false, detail: clientOrderError(error) } }
}

export async function applyLinkedAfterSale(orderId: string, buyerUserRef: string, rowVersion: number, type: 'NEGOTIATED_REFUND' | 'ACCOUNT_ISSUE' | 'ACCOUNT_RETRIEVED', reason: string, refundAmountFen?: number): Promise<LinkedClientActionResult> {
  try {
    await ensureLogin()
    const result = await apiWrite<{ order: LinkedClientOrderRow; aftersaleCaseNo: string | null }>(
      `/client/orders/${encodeURIComponent(orderId)}/after-sale`,
      { buyerUserRef, rowVersion, type, reason, ...(refundAmountFen ? { refundAmountFen } : {}) },
      `linked-order-as-${crypto.randomUUID()}`,
    )
    return { ok: true, order: result.order, aftersaleCaseNo: result.aftersaleCaseNo }
  } catch (error) { return { ok: false, detail: clientOrderError(error) } }
}

/** 最新订单行（含 rowVersion）；用于操作前取 CAS 版本与操作后刷新。 */
export async function fetchLinkedOrderRows(): Promise<LinkedClientOrderRow[]> {
  await ensureLogin()
  return apiFetch<LinkedClientOrderRow[]>('/order-management/orders?page=1&pageSize=50')
}
