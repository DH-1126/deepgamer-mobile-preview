import { useSyncExternalStore } from 'react'
import { pendingOrderStore } from '../repository/pendingOrderStore'
import { isLinkedDataMode } from '../runtime/dataMode'
import { useAuthStatus } from './AuthAccess'
import { EMPTY_PENDING_ORDER_SUMMARY } from './pendingOrderModel'

const emptySnapshot = () => EMPTY_PENDING_ORDER_SUMMARY
const noopSubscribe = () => () => undefined

/** My-orders entry badges and the global Profile badge always use the same summary. */
export function usePendingOrderSummary() {
  const authenticated = useAuthStatus()
  const enabled = authenticated && !isLinkedDataMode
  return useSyncExternalStore(
    enabled ? pendingOrderStore.subscribe : noopSubscribe,
    enabled ? pendingOrderStore.getSnapshot : emptySnapshot,
    enabled ? pendingOrderStore.getSnapshot : emptySnapshot,
  )
}
