import type { ProfileOrder, ProfileOrderStatus, ProfileRole } from '../types/profile'

export function formatMoney(cents: number) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', minimumFractionDigits: 2 }).format(cents / 100)
}

export function getRemainingSeconds(expiresAt: number | undefined, now: number) {
  return expiresAt === undefined ? 0 : Math.max(0, Math.ceil((expiresAt - now) / 1000))
}

export function formatCountdown(expiresAt: number | undefined, now: number) {
  const total = getRemainingSeconds(expiresAt, now)
  if (total <= 0) return '已超时'
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor(total % 3600 / 60)
  const seconds = total % 60
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function countOrders(orders: ProfileOrder[], role: ProfileRole, status: ProfileOrderStatus) {
  return orders.filter((order) => order.role === role && order.status === status).length
}

export function getPendingOrders(orders: ProfileOrder[]) {
  return orders.filter((order) => order.role === 'buyer' && (order.status === 'pending' || order.status === 'bind_success'))
}

export function buildOrderRoute(role: ProfileRole, status?: ProfileOrderStatus) {
  return status ? `/orders?role=${role}&status=${status}` : `/orders?role=${role}`
}
