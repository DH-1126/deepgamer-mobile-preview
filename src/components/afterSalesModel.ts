import type { AfterSaleRecord, AfterSaleStatus } from '../types/aftersale'

export type AfterSaleTab = AfterSaleStatus | 'all'

export const AFTERSALE_TABS: Array<{ value: AfterSaleTab; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'pending_review', label: '待审核' },
  { value: 'supplement', label: '待补充材料' },
  { value: 'platform_processing', label: '处理中' },
  { value: 'completed', label: '已处理' },
  { value: 'refunding', label: '退款中' },
  { value: 'rejected', label: '已驳回' },
  { value: 'withdrawn', label: '已撤销' },
]

const labels: Record<AfterSaleStatus, string> = {
  pending_review: '待客服审核', supplement: '待补充材料', refunding: '退款中', platform_processing: '平台处理中', rejected: '已驳回', completed: '已处理', withdrawn: '已撤销',
}

export function isAfterSaleTab(value: string | null): value is AfterSaleTab {
  return value === 'all' || AFTERSALE_TABS.some((item) => item.value === value)
}

export function getAfterSaleStatusLabel(status: AfterSaleStatus) {
  return labels[status]
}

export function filterAfterSales(records: readonly AfterSaleRecord[], status: AfterSaleTab, query: string) {
  const needle = query.trim().toLocaleLowerCase()
  return records.filter((record) => (status === 'all' || record.status === status) && (!needle || [record.id, record.orderId, record.productId, record.productTitle, record.gameName, record.server].some((value) => value.toLocaleLowerCase().includes(needle))))
}

export function countAfterSales(records: readonly AfterSaleRecord[], status: AfterSaleTab) {
  return status === 'all' ? records.length : records.filter((record) => record.status === status).length
}
