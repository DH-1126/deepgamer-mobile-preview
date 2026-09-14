import { Navigate } from 'react-router-dom'

/** Keep existing links working without a separate consultation-order list. */
export function RecycleOrderListPage() {
  return <Navigate to="/message?tab=recycle" replace />
}
