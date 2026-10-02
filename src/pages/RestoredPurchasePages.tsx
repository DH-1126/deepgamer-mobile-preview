import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Heading, PageHeader, Spinner, SurfaceCard } from '../components/ui'
import { useRestoredClient } from '../linked/RestoredClientProvider'
import { createRestoredOrderApi } from '../linked/restoredOrderApi'
import {
  createRestoredCatalogController,
  createRestoredCheckoutController,
  createRestoredPaymentController,
  paymentBlockedReason,
  quoteUnavailableReason,
  type RestoredCatalogSnapshot,
  type RestoredCheckoutApi,
  type RestoredCheckoutSnapshot,
  type RestoredPaymentRecovery,
  type RestoredPaymentSnapshot,
} from '../linked/restoredPurchaseController'
import { createRestoredPurchaseApi, type RestoredPaymentResult, type RestoredPurchasePackage } from '../linked/restoredPurchaseApi'
import { formatRestoredOrderFen } from './RestoredOrderPages'
import '../styles/restored-purchase.css'

const catalogDisconnected: RestoredCatalogSnapshot = { goods: [], loading: false, error: '公开商品目录未连接' }
const checkoutDisconnected: RestoredCheckoutSnapshot = { goodsId: '', packageId: 'STANDARD', goods: null, quote: null, loading: false, submitting: false, createUnknown: false, error: '购买确认未连接' }
const paymentDisconnected: RestoredPaymentSnapshot = { orderId: '', order: null, context: null, pending: null, lastOperationStatus: null, loading: false, busy: false, error: '支付恢复未连接' }

function RestoredPurchaseBackLink({ to, label }: { to: string; label: string }) {
  return <Link className="restored-purchase-back" to={to} aria-label={label}><ArrowLeft size={18} aria-hidden="true" /><span>返回</span></Link>
}

export function RestoredCatalogView({ snapshot, onRetry }: { snapshot: RestoredCatalogSnapshot; onRetry: () => void }) {
  return <main className="restored-purchase-page">
    <PageHeader title="购买账号" left={<Link className="restored-purchase-back" to="/profile">返回</Link>} />
    <div className="restored-purchase-scroll">
      <SurfaceCard><Heading as="h1" variant="section">已审核在售商品</Heading><p className="restored-purchase-muted">仅显示服务端公开的已审核冻结快照，金额以下一步服务端报价为准。</p></SurfaceCard>
      {snapshot.loading && snapshot.goods.length === 0 && <p className="restored-purchase-state" role="status"><Spinner decorative />正在读取公开商品…</p>}
      {snapshot.error && <section className="restored-purchase-error" role="alert"><p>{snapshot.error}</p><Button variant="outline" onClick={onRetry} disabled={snapshot.loading}>重试读取</Button></section>}
      {!snapshot.loading && !snapshot.error && snapshot.goods.length === 0 && <p className="restored-purchase-state">暂无可购买的已审核商品。</p>}
      {snapshot.goods.length > 0 && <ul className="restored-purchase-catalog">{snapshot.goods.map(item => <li key={item.id}><SurfaceCard as="article">
        <div className="restored-purchase-cover">{item.coverUrl ? <img src={item.coverUrl} alt="" /> : <span aria-hidden="true">账</span>}</div>
        <div><Heading as="h2" variant="subsection">{item.title}</Heading><p>{item.game.name} · {item.seller.displayName}</p><b>{formatRestoredOrderFen(item.priceFen)}</b><small>目录价，非最终应付</small><Link to={`/buy/confirm?goodsId=${encodeURIComponent(item.id)}&package=STANDARD`}>获取报价并购买</Link></div>
      </SurfaceCard></li>)}</ul>}
    </div>
  </main>
}

export function RestoredCheckoutView({ snapshot, onPackageChange, onSubmit, onRetry, onRetryCreate }: {
  snapshot: RestoredCheckoutSnapshot
  onPackageChange: (value: RestoredPurchasePackage) => void
  onSubmit: () => void
  onRetry: () => void
  onRetryCreate: () => void
}) {
  const blocked = quoteUnavailableReason(snapshot.quote)
  return <main className="restored-purchase-page">
    <PageHeader title="购买确认" left={<RestoredPurchaseBackLink to="/buy" label="返回商品列表" />} />
    <div className="restored-purchase-scroll">
      {snapshot.loading && !snapshot.goods && <p className="restored-purchase-state" role="status"><Spinner decorative />正在读取商品与服务端报价…</p>}
      {snapshot.goods && <SurfaceCard className="restored-purchase-summary"><Heading as="h1" variant="section">{snapshot.goods.title}</Heading><p>{snapshot.goods.game.name} · {snapshot.goods.seller.displayName}</p><small>商品快照 {snapshot.goods.snapshotId}</small></SurfaceCard>}
      <SurfaceCard><Heading as="h2" variant="section">交易方案</Heading><div className="restored-purchase-package" role="group" aria-label="交易方案">
        <Button variant={snapshot.packageId === 'STANDARD' ? 'primary' : 'outline'} aria-pressed={snapshot.packageId === 'STANDARD'} disabled={snapshot.loading || snapshot.submitting || snapshot.createUnknown} onClick={() => onPackageChange('STANDARD')}>普通交易</Button>
        <Button variant={snapshot.packageId === 'PREMIUM' ? 'primary' : 'outline'} aria-pressed={snapshot.packageId === 'PREMIUM'} disabled={snapshot.loading || snapshot.submitting || snapshot.createUnknown} onClick={() => onPackageChange('PREMIUM')}>包赔保障</Button>
      </div><p className="restored-purchase-muted">切换方案会重新请求服务端报价，不使用上一方案的金额。</p></SurfaceCard>
      {snapshot.quote && <SurfaceCard><header className="restored-purchase-quote-head"><Heading as="h2" variant="section">服务端报价</Heading><small>{snapshot.quote.quoteId}</small></header><dl className="restored-purchase-breakdown">
        <div><dt>商品金额</dt><dd>{formatRestoredOrderFen(snapshot.quote.amounts.goodsAmountFen)}</dd></div>
        <div><dt>服务费</dt><dd>{formatRestoredOrderFen(snapshot.quote.amounts.serviceFeeFen)}</dd></div>
        <div><dt>保障费</dt><dd>{formatRestoredOrderFen(snapshot.quote.amounts.guaranteeFeeFen)}</dd></div>
        <div><dt>优惠</dt><dd>-{formatRestoredOrderFen(snapshot.quote.amounts.discountFen)}</dd></div>
        <div className="is-total"><dt>应付金额</dt><dd>{formatRestoredOrderFen(snapshot.quote.amounts.payableAmountFen)}</dd></div>
      </dl><p className="restored-purchase-muted">报价有效至 {snapshot.quote.expiresAt}；下单只引用该报价标识，不提交前端金额。</p></SurfaceCard>}
      {snapshot.error && <section className="restored-purchase-error" role="alert"><p>{snapshot.error}</p>{snapshot.createUnknown ? <Button variant="outline" onClick={onRetryCreate} disabled={snapshot.submitting}>用原报价与原固定键重试</Button> : <Button variant="outline" onClick={onRetry} disabled={snapshot.loading || snapshot.submitting}>重新获取报价</Button>}</section>}
      <SurfaceCard className="restored-purchase-demo-note"><b>本地恢复联动</b><p>创建的是本地待付款订单；不调用真实支付渠道。</p></SurfaceCard>
      <Button fullWidth size="xl" loading={snapshot.submitting} disabled={snapshot.loading || Boolean(blocked) || !snapshot.quote || snapshot.createUnknown} onClick={onSubmit}>创建待付款订单</Button>
    </div>
  </main>
}

export function RestoredPaymentView({ snapshot, onResult, onCheckPending, onRetryOriginal, onResolveUnknown, onRetry }: {
  snapshot: RestoredPaymentSnapshot
  onResult: (result: RestoredPaymentResult) => void
  onCheckPending: () => void
  onRetryOriginal: () => void
  onResolveUnknown: (result: 'SUCCESS' | 'FAILED') => void
  onRetry: () => void
}) {
  const pendingRef = useRef<HTMLElement>(null)
  useEffect(() => { if (snapshot.pending) pendingRef.current?.focus() }, [snapshot.pending?.operationId])
  const blocked = paymentBlockedReason(snapshot.order, snapshot.context)
  const canResolve = snapshot.pending && snapshot.context?.operation?.operationId === snapshot.pending.operationId && snapshot.context.operation.status === 'UNKNOWN'
  return <main className="restored-purchase-page">
    <PageHeader title="本地模拟支付" left={<RestoredPurchaseBackLink to={`/orders/${encodeURIComponent(snapshot.orderId || '')}?view=buy`} label="返回订单" />} />
    <div className="restored-purchase-scroll">
      <SurfaceCard className="restored-purchase-demo-note"><Heading as="h1" variant="section">本地模拟，非真实收款</Heading><p>由你明确选择 SUCCESS、FAILED 或 UNKNOWN；页面不调用真实渠道，也不得把 UNKNOWN 判定为未扣款。</p></SurfaceCard>
      {snapshot.loading && !snapshot.order && <p className="restored-purchase-state" role="status"><Spinner decorative />正在读取本人订单与支付上下文…</p>}
      {snapshot.order && <SurfaceCard><Heading as="h2" variant="section">{snapshot.order.goods.title}</Heading><p>{snapshot.order.orderNo} · 原始状态 {snapshot.order.status}</p><dl className="restored-purchase-payment-facts"><div><dt>应付</dt><dd>{snapshot.order.financials?.amounts ? formatRestoredOrderFen(snapshot.order.financials.amounts.payableAmountFen) : '暂不可用'}</dd></div><div><dt>已付</dt><dd>{formatRestoredOrderFen(snapshot.order.financials?.paidAmountFen ?? snapshot.order.paidAmountFen)}</dd></div><div><dt>已退</dt><dd>{formatRestoredOrderFen(snapshot.order.financials?.refundedAmountFen ?? snapshot.order.refundedAmountFen)}</dd></div></dl></SurfaceCard>}
      {snapshot.error && <section className="restored-purchase-error" role="alert"><p>{snapshot.error}</p>{!snapshot.pending && <Button variant="outline" onClick={onRetry} disabled={snapshot.busy}>重试读取</Button>}</section>}
      {snapshot.pending && <SurfaceCard ref={pendingRef} tabIndex={-1} data-restored-payment-pending="true" className="restored-payment-pending"><Heading as="h2" variant="section">原支付操作结果待确认</Heading><p>操作号 {snapshot.pending.operationId}</p><p>不能假定未扣款，不会创建新订单或新 operation。</p><div className="restored-purchase-actions">
        <Button variant="outline" onClick={onCheckPending} disabled={snapshot.busy}>查询原操作结果</Button>
        <Button variant="outline" onClick={onRetryOriginal} disabled={snapshot.busy}>用原请求重试</Button>
        {canResolve && <><Button onClick={() => onResolveUnknown('SUCCESS')} disabled={snapshot.busy}>确认原操作模拟成功</Button><Button variant="danger" onClick={() => onResolveUnknown('FAILED')} disabled={snapshot.busy}>确认原操作模拟失败</Button></>}
      </div></SurfaceCard>}
      {!snapshot.pending && snapshot.lastOperationStatus === 'FAILED' && <SurfaceCard className="restored-payment-result is-failed"><b>上一次模拟支付明确失败</b><p>可在同一待付款订单上创建新操作，不重复下单。</p></SurfaceCard>}
      {snapshot.lastOperationStatus === 'REFUND_REQUIRED' && <SurfaceCard className="restored-payment-result is-refund"><b>已记录待退款义务</b><p>本笔模拟实收未取得商品归属，当前是待退款，不表示退款已到账。</p></SurfaceCard>}
      {!snapshot.pending && snapshot.order && snapshot.context && <SurfaceCard><Heading as="h2" variant="section">选择本次模拟结果</Heading>{blocked ? <p className="restored-purchase-blocked">{blocked}</p> : <div className="restored-purchase-actions"><Button onClick={() => onResult('SUCCESS')} disabled={snapshot.busy}>模拟成功</Button><Button variant="danger" onClick={() => onResult('FAILED')} disabled={snapshot.busy}>模拟失败</Button><Button variant="outline" onClick={() => onResult('UNKNOWN')} disabled={snapshot.busy}>模拟结果未知</Button></div>}<p className="restored-purchase-muted">连续点击会被阻止；提交前会固定 operationId、结果、rowVersion 和 HTTP 幂等键。</p></SurfaceCard>}
    </div>
  </main>
}

export function RestoredCatalogPage() {
  const { transport } = useRestoredClient()
  const controller = useMemo(() => transport ? createRestoredCatalogController(createRestoredPurchaseApi(transport)) : null, [transport])
  const snapshot = useSyncExternalStore(controller?.subscribe ?? (() => () => undefined), controller?.getSnapshot ?? (() => catalogDisconnected), controller?.getSnapshot ?? (() => catalogDisconnected))
  useEffect(() => { if (!controller) return undefined; void controller.start(); return () => controller.stop() }, [controller])
  return <RestoredCatalogView snapshot={snapshot} onRetry={() => { void controller?.retry() }} />
}

export function RestoredCheckoutRoute({ api }: { api: RestoredCheckoutApi | null }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const paramsRef = useRef(searchParams); paramsRef.current = searchParams
  const setParamsRef = useRef(setSearchParams); setParamsRef.current = setSearchParams
  const goodsId = searchParams.get('goodsId') ?? ''
  const packageId: RestoredPurchasePackage = searchParams.get('package') === 'PREMIUM' ? 'PREMIUM' : 'STANDARD'
  const quoteId = searchParams.get('quoteId') ?? undefined
  const rawCreateKey = searchParams.get('createKey') ?? undefined
  const createKey = rawCreateKey && /^[\x21-\x7e]{8,100}$/u.test(rawCreateKey) ? rawCreateKey : undefined
  const routeRef = useRef({ goodsId, packageId }); routeRef.current = { goodsId, packageId }
  const controller = useMemo(() => api ? createRestoredCheckoutController(api, {
    onQuoteRecovery: (recoveredQuoteId, recoveredCreateKey) => {
      const next = new URLSearchParams(paramsRef.current)
      next.set('goodsId', routeRef.current.goodsId)
      next.set('package', routeRef.current.packageId)
      next.set('quoteId', recoveredQuoteId)
      next.set('createKey', recoveredCreateKey)
      setParamsRef.current(next, { replace: true })
    },
    onOrder: (orderId, recoveredQuoteId) => navigate(`/orders/${encodeURIComponent(orderId)}/payment?quoteId=${encodeURIComponent(recoveredQuoteId)}`, { replace: true }),
  }) : null, [api, goodsId, navigate])
  const snapshot = useSyncExternalStore(controller?.subscribe ?? (() => () => undefined), controller?.getSnapshot ?? (() => ({ ...checkoutDisconnected, goodsId, packageId })), controller?.getSnapshot ?? (() => ({ ...checkoutDisconnected, goodsId, packageId })))
  useEffect(() => { if (!controller || !goodsId) return undefined; void controller.start({ goodsId, packageId, quoteId, createKey }); return () => controller.stop() }, [controller, goodsId])
  const changePackage = (nextPackage: RestoredPurchasePackage) => {
    if (snapshot.createUnknown || snapshot.submitting) return
    routeRef.current = { goodsId, packageId: nextPackage }
    const next = new URLSearchParams({ goodsId, package: nextPackage }); setSearchParams(next, { replace: true }); void controller?.selectPackage(nextPackage)
  }
  if (!goodsId) return <RestoredCheckoutView snapshot={{ ...checkoutDisconnected, error: '缺少公开商品标识' }} onPackageChange={changePackage} onSubmit={() => undefined} onRetry={() => undefined} onRetryCreate={() => undefined} />
  return <RestoredCheckoutView snapshot={snapshot} onPackageChange={changePackage} onSubmit={() => { void controller?.submitOrder() }} onRetry={() => { void controller?.refreshQuote() }} onRetryCreate={() => { void controller?.retryCreate() }} />
}

export function RestoredCheckoutPage() {
  const { transport } = useRestoredClient()
  const api = useMemo(() => transport ? createRestoredPurchaseApi(transport) : null, [transport])
  return <RestoredCheckoutRoute api={api} />
}

function paymentRecovery(params: URLSearchParams): RestoredPaymentRecovery | null {
  const operationId = params.get('operationId'), result = params.get('result'), rowVersion = Number(params.get('rowVersion'))
  if (!operationId || !/^[\x21-\x7e]{8,100}$/u.test(operationId) || !['SUCCESS', 'FAILED', 'UNKNOWN'].includes(result ?? '') || !Number.isSafeInteger(rowVersion) || rowVersion < 1) return null
  return { operationId, simulatedResult: result as RestoredPaymentResult, rowVersion }
}

export function RestoredPaymentPage() {
  const { orderId = '' } = useParams()
  const { transport } = useRestoredClient()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const paramsRef = useRef(searchParams); paramsRef.current = searchParams
  const setParamsRef = useRef(setSearchParams); setParamsRef.current = setSearchParams
  const recovery = paymentRecovery(searchParams)
  const purchaseApi = useMemo(() => transport ? createRestoredPurchaseApi(transport) : null, [transport])
  const orderApi = useMemo(() => transport ? createRestoredOrderApi(transport) : null, [transport])
  const controller = useMemo(() => purchaseApi && orderApi ? createRestoredPaymentController({
    readOrder: orderApi.read,
    readPaymentContext: purchaseApi.readPaymentContext,
    submitPayment: purchaseApi.submitPayment,
  }, {
    onRecovery: nextRecovery => {
      const next = new URLSearchParams(paramsRef.current)
      if (nextRecovery) { next.set('operationId', nextRecovery.operationId); next.set('result', nextRecovery.simulatedResult); next.set('rowVersion', String(nextRecovery.rowVersion)) }
      else { next.delete('operationId'); next.delete('result'); next.delete('rowVersion') }
      setParamsRef.current(next, { replace: true })
    },
    onSettled: status => { if (status === 'SUCCEEDED' || status === 'REFUND_REQUIRED') navigate(`/orders/${encodeURIComponent(orderId)}?view=buy&payment=${status}`, { replace: true }) },
  }) : null, [navigate, orderApi, orderId, purchaseApi])
  const snapshot = useSyncExternalStore(controller?.subscribe ?? (() => () => undefined), controller?.getSnapshot ?? (() => ({ ...paymentDisconnected, orderId })), controller?.getSnapshot ?? (() => ({ ...paymentDisconnected, orderId })))
  useEffect(() => { if (!controller || !orderId) return undefined; void controller.start(orderId, recovery); return () => controller.stop() }, [controller, orderId])
  return <RestoredPaymentView snapshot={snapshot} onResult={result => { void controller?.startPayment(result) }} onCheckPending={() => { void controller?.checkPending() }} onRetryOriginal={() => { void controller?.retryOriginal() }} onResolveUnknown={result => { void controller?.resolveUnknown(result) }} onRetry={() => { void controller?.refresh() }} />
}
