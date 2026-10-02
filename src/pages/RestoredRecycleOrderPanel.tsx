import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { Button, Spinner, StatusBadge, TextField } from '../components/ui'
import { useRestoredClient } from '../linked/RestoredClientProvider'
import { createRestoredRecycleOrderApi, createRestoredRecycleOrderController, type RestoredRecycleOrderSnapshot } from '../linked/restoredRecycleOrderController'

const statusLabels: Record<string, string> = {
  active: '待卖家确认', pending_payment: '待支付', completed: '已完成', rejected: '已驳回',
  expired: '已过期', payment_expired: '支付超时', invalidated: '已作废',
}
const yuan = (fen: number) => `¥${(fen / 100).toFixed(2)}`

const disconnected: RestoredRecycleOrderSnapshot = { loading: false, stale: false, error: '本地联动未连接，请重新连接', order: null, canQuote: false, role: 'none', busy: false, actionState: 'idle', actionError: null, lastAction: null }

/** W04-B：回收咨询会话内的回收单区块——回收商报价/支付，卖家确认/拒绝，双方同源读状态。 */
export function RestoredRecycleOrderPanel({ consultationId, associationRecyclerId, associationStatus }: { consultationId: string; associationRecyclerId: string; associationStatus: string | null }) {
  const { transport, connection } = useRestoredClient()
  const identity = connection?.actor.managementId
  const recyclerId = connection?.actor.recyclerId ?? null
  const controller = useMemo(() => transport && identity ? createRestoredRecycleOrderController(
    consultationId,
    createRestoredRecycleOrderApi(transport),
    { managementId: identity, recyclerId },
    associationRecyclerId,
  ) : null, [transport, identity, recyclerId, consultationId, associationRecyclerId])
  const state = useSyncExternalStore(
    controller?.subscribe ?? (() => () => undefined),
    controller?.getSnapshot ?? (() => disconnected),
    controller?.getSnapshot ?? (() => disconnected),
  )
  useEffect(() => {
    if (!controller) return undefined
    void controller.start()
    return () => controller.stop()
  }, [controller])
  // association 状态变化（如消息页刷新后）说明服务端订单可能已推进，拉一次详情对齐。
  const lastAssociation = useRef(associationStatus)
  useEffect(() => {
    if (controller && lastAssociation.current !== associationStatus) {
      lastAssociation.current = associationStatus
      void controller.refresh()
    }
  }, [associationStatus, controller])

  return <RecycleOrderPanelView state={state} onQuote={input => { void controller?.quote(input) }} onConfirm={() => { void controller?.confirm() }} onReject={reason => { void controller?.reject(reason) }} onPay={() => { void controller?.pay() }} onRetryUnknown={() => { void controller?.retryUnknown() }} onRefresh={() => { void controller?.refresh() }} />
}

const inputState = (value: string) => {
  const amountFen = Math.round(Number(value) * 100)
  return Number.isFinite(amountFen) && amountFen >= 100 && `${amountFen}` !== '' ? amountFen : null
}

export function RecycleOrderPanelView({ state, onQuote, onConfirm, onReject, onPay, onRetryUnknown, onRefresh }: {
  state: RestoredRecycleOrderSnapshot
  onQuote: (input: { quoteAmountFen: number; loginAccount: string; description?: string }) => void
  onConfirm: () => void
  onReject: (reason: string) => void
  onPay: () => void
  onRetryUnknown: () => void
  onRefresh: () => void
}) {
  const [amount, setAmount] = useState('')
  const [account, setAccount] = useState('')
  const [remark, setRemark] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const order = state.order
  const quoteReady = (inputState(amount) ?? 0) >= 100 && account.trim().length > 0
  return <section className="restored-recycle-order" aria-label="回收单">
    {state.loading && <p role="status" className="restored-recycle-order-line"><Spinner decorative />正在读取回收单…</p>}
    {!state.loading && state.error && <p role="alert" className="restored-recycle-order-line restored-recycle-order-error">{state.error}<Button size="xs" variant="outline" onClick={onRefresh}>重试</Button></p>}
    {!state.loading && !state.error && <>
      {order && <p className="restored-recycle-order-line">
        <b>回收单 {order.recycleOrderNo}</b>
        <StatusBadge tone={order.status === 'completed' ? 'success' : order.status === 'rejected' || order.status === 'expired' || order.status === 'invalidated' ? 'neutral' : 'brand'}>{statusLabels[order.status] ?? order.status}</StatusBadge>
      </p>}
      {order && <p className="restored-recycle-order-line">
        报价 {yuan(order.quoteAmountFen)} · 包赔费 {yuan(order.guaranteeFeeAmountFen)}（费率 {Number(order.guaranteeFeeRate) * 100}% 由回收商承担）
        {state.role === 'recycler' ? ` · 应付 ${yuan(order.buyerPayAmountFen)}` : state.role === 'seller' ? ` · 预计到手 ${yuan(order.sellerReceivableAmountFen)}` : ''}
        {order.paymentStatus === 'PAID' ? ' · 已支付' : ''}
      </p>}
      {order && state.role === 'seller' && order.status === 'active' && <div className="restored-recycle-order-actions">
        <p className="restored-recycle-order-line">回收商已正式报价，确认后进入待支付。</p>
        {!rejecting && <div className="restored-recycle-order-buttons">
          <Button size="sm" disabled={state.busy} onClick={onConfirm}>确认报价</Button>
          <Button size="sm" variant="outline" disabled={state.busy} onClick={() => setRejecting(true)}>拒绝</Button>
        </div>}
        {rejecting && <div className="restored-recycle-order-reject">
          <TextField label="拒绝原因" value={reason} maxLength={200} onChange={event => setReason(event.target.value)} />
          <div className="restored-recycle-order-buttons">
            <Button size="sm" variant="outline" disabled={state.busy || reason.trim().length < 2} onClick={() => { onReject(reason.trim()); setRejecting(false); setReason('') }}>确认拒绝</Button>
            <Button size="sm" variant="ghost" disabled={state.busy} onClick={() => { setRejecting(false); setReason('') }}>取消</Button>
          </div>
        </div>}
      </div>}
      {order && state.role === 'recycler' && order.status === 'pending_payment' && <div className="restored-recycle-order-buttons">
        <p className="restored-recycle-order-line">卖家已确认，请在报价有效期内完成支付。</p>
        <Button size="sm" disabled={state.busy} onClick={onPay}>支付 {yuan(order.buyerPayAmountFen)}</Button>
      </div>}
      {!order && state.canQuote && <div className="restored-recycle-order-quote">
        <p className="restored-recycle-order-line">你可以对该咨询发起正式报价；卖家确认后进入待支付。</p>
        <TextField label="报价金额（元）" value={amount} inputMode="decimal" placeholder="如 199.00" onChange={event => setAmount(event.target.value)} />
        <TextField label="游戏账号" value={account} maxLength={80} onChange={event => setAccount(event.target.value)} />
        <TextField label="备注（可选）" value={remark} maxLength={300} onChange={event => setRemark(event.target.value)} />
        <Button size="sm" disabled={state.busy || !quoteReady} onClick={() => { const amountFen = inputState(amount); if (amountFen) { onQuote({ quoteAmountFen: amountFen, loginAccount: account.trim(), description: remark.trim() || undefined }); setAmount(''); setAccount(''); setRemark('') } }}>发起正式报价</Button>
      </div>}
      {!order && !state.canQuote && state.role === 'none' && !state.loading && <p className="restored-recycle-order-line">尚未建立回收单。</p>}
      {state.actionState === 'unknown' && <p role="status" className="restored-recycle-order-line restored-recycle-order-error">{state.actionError}<Button size="xs" variant="outline" disabled={state.busy} onClick={onRetryUnknown}>重试原操作</Button></p>}
      {state.actionError && state.actionState !== 'unknown' && <p role="alert" className="restored-recycle-order-line restored-recycle-order-error">{state.actionError}</p>}
    </>}
  </section>
}
