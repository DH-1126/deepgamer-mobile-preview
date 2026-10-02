import type { SellGameCode } from '../types/sell'
import { getLinkedState, getLinkedUsers } from './linkedData'

/**
 * HTTP 联动的回收单客户端封装（2026-09-23）：
 * 本地 recycleRepository 仍驱动界面状态机，创建/确认/拒绝/支付四个动作镜像到
 * admin-api /client/recycle/orders；backendRecycleOrderId 挂回本地单做后续动作的定位。
 */

const API_BASE = '/api/v1'

export type LinkedRecycleActionResult =
  | { ok: true; backendRecycleOrderId: string; status: string }
  | { ok: false; detail: string }

async function ensureLinkedSession(): Promise<void> {
  const probe = await fetch(`${API_BASE}/game-management/games?page=1&pageSize=1`, { credentials: 'same-origin' })
  if (probe.status === 401) {
    const login = await fetch('/linked-api/login', { method: 'POST', credentials: 'same-origin' })
    if (!login.ok) throw new Error('后台会话未登录，请刷新页面重新连接')
  }
}

async function recycleWrite(path: string, body: Record<string, unknown>): Promise<{ recycle_order_id: string; status: string }> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken(), 'idempotency-key': `linked-recycle-${crypto.randomUUID()}` },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { detail?: string } | null
    throw new Error(problem?.detail ?? `后台回收单操作失败（${response.status}）`)
  }
  const payload = (await response.json()) as { data?: { order: { recycle_order_id: string; status: string } } }
  if (!payload.data) throw new Error('后台回收单响应缺失')
  return payload.data.order
}

function csrfToken(): string {
  // linked 登录中间件会把 csrfToken 写入 cookie；写操作前统一经 ensureLinkedSession 刷新会话。
  const match = document.cookie.match(/(?:^|;\s*)csrfToken=([^;]+)/)
  return match ? decodeURIComponent(match[1]!) : ''
}

/** 本地流程单的回收商 id 形如 `recycler_aurora|linked`；后台需要裸 id。 */
export function stripLinkedRecyclerId(recyclerId: string): string {
  return recyclerId.replace(/\|linked$/, '')
}

/** 当前联动卖家（回收流程里卖号的用户）；与订单买家共用同一演示身份池。 */
export function getLinkedSellerRef(): string {
  const users = getLinkedUsers(getLinkedState())
  return (users.find((user) => user.roles.includes('seller')) ?? users[0])?.id ?? ''
}

export async function createLinkedRecycleOrder(input: {
  gameCode: SellGameCode | string
  recyclerId: string
  sellerUserRef: string
  loginAccount: string
  quoteAmountFen: number
  description?: string
}): Promise<LinkedRecycleActionResult> {
  try {
    await ensureLinkedSession()
    const order = await recycleWrite('/client/recycle/orders', {
      gameCode: input.gameCode,
      recyclerId: stripLinkedRecyclerId(input.recyclerId),
      sellerUserRef: input.sellerUserRef,
      loginAccount: input.loginAccount,
      quoteAmountFen: input.quoteAmountFen,
      description: input.description || '用户端联动回收咨询',
    })
    return { ok: true, backendRecycleOrderId: order.recycle_order_id, status: order.status }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : '后台回收单创建失败' }
  }
}

export async function confirmLinkedRecycleOrder(backendRecycleOrderId: string, sellerUserRef: string): Promise<LinkedRecycleActionResult> {
  try {
    await ensureLinkedSession()
    const order = await recycleWrite(`/client/recycle/orders/${encodeURIComponent(backendRecycleOrderId)}/confirm`, { sellerUserRef })
    return { ok: true, backendRecycleOrderId: order.recycle_order_id, status: order.status }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : '后台回收单确认失败' }
  }
}

export async function rejectLinkedRecycleOrder(backendRecycleOrderId: string, sellerUserRef: string, reason: string): Promise<LinkedRecycleActionResult> {
  try {
    await ensureLinkedSession()
    const order = await recycleWrite(`/client/recycle/orders/${encodeURIComponent(backendRecycleOrderId)}/reject`, { sellerUserRef, reason })
    return { ok: true, backendRecycleOrderId: order.recycle_order_id, status: order.status }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : '后台回收单拒绝失败' }
  }
}

export async function payLinkedRecycleOrder(backendRecycleOrderId: string, recyclerId: string): Promise<LinkedRecycleActionResult> {
  try {
    await ensureLinkedSession()
    const order = await recycleWrite(`/client/recycle/orders/${encodeURIComponent(backendRecycleOrderId)}/pay`, {
      recyclerId: stripLinkedRecyclerId(recyclerId),
    })
    return { ok: true, backendRecycleOrderId: order.recycle_order_id, status: order.status }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : '后台回收单支付失败' }
  }
}
