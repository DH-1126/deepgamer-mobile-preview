import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Button, Heading, PageHeader, Spinner, SurfaceCard, Tabs } from '../components/ui'
import { useRestoredClient } from '../linked/RestoredClientProvider'
import { createRestoredOrderApi, type RestoredOrderView, type RestoredOwnedOrder } from '../linked/restoredOrderApi'
import { RestoredHttpError } from '../linked/restoredLinkedTransport'
import '../styles/restored-orders.css'
import { RestoredOrderSignature } from '../components/RestoredOrderSignature'
import { RestoredOrderLocalFulfillment } from '../components/RestoredOrderLocalFulfillment'
import { RestoredOrderConfirmation } from '../components/RestoredOrderConfirmation'
import { RestoredOrderSettlement } from '../components/RestoredOrderSettlement'

type OrderListApi = Pick<ReturnType<typeof createRestoredOrderApi>, 'listAll'>
type OrderDetailApi = Pick<ReturnType<typeof createRestoredOrderApi>, 'read'>

export type RestoredOrdersSnapshot = { view: RestoredOrderView; orders: RestoredOwnedOrder[]; loading: boolean; stale: boolean; error: string | null }
export type RestoredOrderDetailSnapshot = { orderId: string; order: RestoredOwnedOrder | null; loading: boolean; stale: boolean; error: string | null }

const listDisconnected: RestoredOrdersSnapshot = { view: 'buy', orders: [], loading: false, stale: false, error: '本地订单读取未连接' }
const detailDisconnected: RestoredOrderDetailSnapshot = { orderId: '', order: null, loading: false, stale: false, error: '本地订单读取未连接' }
const message = (error: unknown) => error instanceof Error && error.message ? error.message : '订单读取失败，请重试'
const mustClearOrder = (error: unknown) => error instanceof RestoredHttpError && [401, 403, 404].includes(error.status)

// One timer per mounted reader; requests schedule the next read only after settling.
function createOrderRefreshSchedule(refresh: () => Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let failures = 0
  const clear = () => { clearTimeout(timer); timer = undefined }
  return {
    clear,
    reset() { failures = 0; clear() },
    afterRead(success: boolean) {
      clear()
      failures = success ? 0 : failures + 1
      const delay = success ? 5000 : [5000, 10000, 20000, 30000][Math.min(failures - 1, 3)]
      timer = setTimeout(() => { void refresh() }, delay)
    },
  }
}
export function createRestoredOrdersController(api: OrderListApi) {
  let snapshot: RestoredOrdersSnapshot = { view: 'buy', orders: [], loading: false, stale: false, error: null }
  let active = false, generation = 0, visible = true
  let pending: AbortController | undefined
  const listeners = new Set<() => void>()
  const publish = (next: RestoredOrdersSnapshot) => { snapshot = next; listeners.forEach(listener => listener()) }
  const polling = createOrderRefreshSchedule(async () => { await load(snapshot.view) })
  async function load(view: RestoredOrderView) {
    if (!active) return
    polling.clear()
    const token = ++generation
    pending?.abort(); const request = new AbortController(); pending = request
    const changingView = snapshot.view !== view
    if (changingView) polling.reset()
    publish({ view, orders: changingView ? [] : snapshot.orders, loading: visible, stale: changingView ? false : snapshot.stale, error: changingView ? null : snapshot.error })
    if (!visible) { pending = undefined; return }
    try {
      const orders = await api.listAll(view, request.signal)
      if (active && token === generation) { publish({ view, orders, loading: false, stale: false, error: null }); polling.afterRead(true) }
    } catch (error) {
      if (!active || token !== generation) return
      const rows = mustClearOrder(error) ? [] : snapshot.orders
      publish({ ...snapshot, orders: rows, loading: false, stale: rows.length > 0, error: message(error) })
      polling.afterRead(false)
    } finally { if (pending === request) pending = undefined }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener) },
    async start(view: RestoredOrderView) { if (active) return; active = true; await load(view) },
    setView: load,
    async retry() { await load(snapshot.view) },
    async setVisible(next: boolean) {
      if (visible === next) return
      visible = next; generation += 1; polling.clear(); pending?.abort(); pending = undefined
      if (active && visible) await load(snapshot.view)
    },
    stop() { active = false; generation += 1; polling.clear(); pending?.abort(); pending = undefined; listeners.clear() },
  }
}

export function createRestoredOrderDetailController(api: OrderDetailApi) {
  let snapshot: RestoredOrderDetailSnapshot = { ...detailDisconnected, error: null }
  let active = false, generation = 0, visible = true
  let pending: AbortController | undefined
  const listeners = new Set<() => void>()
  const publish = (next: RestoredOrderDetailSnapshot) => { snapshot = next; listeners.forEach(listener => listener()) }
  const polling = createOrderRefreshSchedule(async () => { await load(snapshot.orderId) })
  async function load(orderId: string) {
    if (!active) return
    polling.clear()
    const token = ++generation
    pending?.abort(); const request = new AbortController(); pending = request
    const changingOrder = snapshot.orderId !== orderId
    if (changingOrder) polling.reset()
    publish({ orderId, order: changingOrder ? null : snapshot.order, loading: visible, stale: changingOrder ? false : snapshot.stale, error: changingOrder ? null : snapshot.error })
    if (!visible) { pending = undefined; return }
    try {
      const order = await api.read(orderId, request.signal)
      if (active && token === generation) { publish({ orderId, order, loading: false, stale: false, error: null }); polling.afterRead(true) }
    } catch (error) {
      if (!active || token !== generation) return
      const order = mustClearOrder(error) ? null : snapshot.order
      publish({ ...snapshot, order, loading: false, stale: order !== null, error: message(error) })
      polling.afterRead(false)
    } finally { if (pending === request) pending = undefined }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => listeners.delete(listener) },
    async start(orderId: string) { if (active) return; active = true; await load(orderId) },
    load,
    async retry() { if (snapshot.orderId) await load(snapshot.orderId) },
    async setVisible(next: boolean) {
      if (visible === next) return
      visible = next; generation += 1; polling.clear(); pending?.abort(); pending = undefined
      if (active && visible && snapshot.orderId) await load(snapshot.orderId)
    },
    stop() { active = false; generation += 1; polling.clear(); pending?.abort(); pending = undefined; listeners.clear() },
  }
}

export function formatRestoredOrderFen(value: number) {
  return `¥${(value / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function canContinueRestoredPayment(order: RestoredOwnedOrder) {
  return order.status === 'PENDING_PAYMENT' && order.provenance === 'LOCAL_DEMO' && order.viewRoles.includes('BUYER')
}

export function projectRestoredOrdersSnapshot(snapshot: RestoredOrdersSnapshot, view: RestoredOrderView): RestoredOrdersSnapshot {
  return snapshot.view === view ? snapshot : { view, orders: [], loading: true, stale: false, error: null }
}

export function projectRestoredOrderDetailSnapshot(snapshot: RestoredOrderDetailSnapshot, orderId: string): RestoredOrderDetailSnapshot {
  return snapshot.orderId === orderId ? snapshot : { orderId, order: null, loading: true, stale: false, error: null }
}

function OrderFinancialFacts({ order, detail = false }: { order: RestoredOwnedOrder; detail?: boolean }) {
  const facts = order.financials
  if (!facts) return <p className="restored-order-unavailable">金额事实暂不可用：该兼容记录未返回已冻结的资金事实。</p>
  return <>
    {facts.provenance === 'LOCAL_DEMO' && <p className="restored-order-demo-note">本地演示订单未接入真实支付或退款，金额仅用于本地联调验收。</p>}
    {facts.provenance === 'UNVERIFIED' && <p className="restored-order-unavailable">历史关系未核验，仅可查看；冻结金额分项和待退款事实暂不可用。</p>}
    {detail && facts.amounts && <dl className="restored-order-breakdown">
      <div><dt>商品金额</dt><dd>{formatRestoredOrderFen(facts.amounts.goodsAmountFen)}</dd></div>
      <div><dt>服务费</dt><dd>{formatRestoredOrderFen(facts.amounts.serviceFeeFen)}</dd></div>
      <div><dt>保障费</dt><dd>{formatRestoredOrderFen(facts.amounts.guaranteeFeeFen)}</dd></div>
      <div><dt>优惠</dt><dd>-{formatRestoredOrderFen(facts.amounts.discountFen)}</dd></div>
    </dl>}
    <dl className="restored-order-money-grid">
      <div><dt>冻结应付</dt><dd>{facts.amounts ? formatRestoredOrderFen(facts.amounts.payableAmountFen) : '暂不可用'}</dd></div>
      <div><dt>已付金额</dt><dd>{formatRestoredOrderFen(facts.paidAmountFen)}</dd></div>
      <div><dt>待退款义务</dt><dd>{facts.pendingRefundAmountFen === null ? '暂不可用' : formatRestoredOrderFen(facts.pendingRefundAmountFen)}</dd></div>
      <div><dt>已退款金额</dt><dd>{formatRestoredOrderFen(facts.refundedAmountFen)}</dd></div>
    </dl>
    {facts.provenance === 'LOCAL_DEMO' && facts.pendingRefundAmountFen !== null && <section className="restored-order-refund-progress" aria-label="退款进度">
      <strong>退款进度 · 本地模拟</strong>
      <p>{facts.pendingRefundAmountFen > 0
        ? facts.refundedAmountFen > 0 ? '部分金额已退，仍有待退款。' : '已记录待退款，退款尚未完成；订单关闭不代表未扣款。'
        : facts.refundedAmountFen > 0 ? '当前无待退款义务，已退金额见上方记录。' : '暂无退款记录。'}</p>
      {(facts.pendingRefundAmountFen > 0 || facts.refundedAmountFen > 0) && <small>仅展示本地接口确认的金额；不代表真实资金到账，也不改变原订单状态。</small>}
    </section>}
  </>
}

export function RestoredOrderListView({ snapshot, onViewChange, onRetry }: { snapshot: RestoredOrdersSnapshot; onViewChange: (view: RestoredOrderView) => void; onRetry: () => void }) {
  const { view, orders, loading, stale, error } = snapshot
  return <main className="restored-orders-page">
    <PageHeader title="本人买卖订单" left={<Link className="restored-order-back" to="/profile">返回</Link>} />
    <div className="restored-orders-scroll">
      <SurfaceCard className="restored-orders-intro"><p>只展示服务端绑定主体的订单。仅本人本地演示待付款单可继续模拟支付；取消和售后执行未在本页开放。</p></SurfaceCard>
      <Tabs label="订单视角" value={view} onValueChange={value => onViewChange(value as RestoredOrderView)} items={[{ value: 'buy', label: '买入订单' }, { value: 'sell', label: '卖出订单' }]} />
      {!error && <div className="restored-orders-actions"><Button variant="outline" size="md" onClick={onRetry} loading={loading}>刷新订单</Button></div>}
      {loading && orders.length === 0 && <p className="restored-orders-state" role="status"><Spinner decorative />正在读取本人{view === 'buy' ? '买入' : '卖出'}订单…</p>}
      {error && <div className="restored-orders-error"><p role="alert">{error}{stale ? '（当前列表可能已过期）' : ''}</p><Button variant="outline" onClick={onRetry} disabled={loading}>重试读取</Button></div>}
      {!loading && !error && orders.length === 0 && <p className="restored-orders-state">暂无本人{view === 'buy' ? '买入' : '卖出'}订单。</p>}
      {orders.length > 0 && <ul className="restored-order-list">{orders.map(order => <li key={order.id}><article>
        <header><span>{order.statusLabel}</span>{order.provenance === 'LOCAL_DEMO' ? <em>本地演示</em> : <em>历史未核验</em>}</header>
        <div className="restored-order-title"><div>{order.goods.coverUrl ? <img src={order.goods.coverUrl} alt="" /> : <span aria-hidden="true">账</span>}</div><p><b>{order.goods.title}</b><small>{order.goods.game.name} · {order.goods.regionName} · {order.goods.serverName}</small><small>订单号 {order.orderNo}</small><small>原始状态：{order.status}</small></p></div>
        <OrderFinancialFacts order={order} />
        <footer>{canContinueRestoredPayment(order) && <Link className="restored-order-pay-link" to={`/orders/${encodeURIComponent(order.id)}/payment`}>继续本地模拟支付</Link>}<Link to={`/orders/${encodeURIComponent(order.id)}?view=${view}`}>查看订单详情</Link></footer>
      </article></li>)}</ul>}
    </div>
  </main>
}

export function RestoredOrderDetailView({ snapshot, returnView, onRetry }: { snapshot: RestoredOrderDetailSnapshot; returnView: RestoredOrderView; onRetry: () => void }) {
  const { order, loading, stale, error } = snapshot
  return <main className="restored-orders-page">
    <PageHeader title="订单详情" left={<Link className="restored-order-back" to={`/orders?view=${returnView}`}>返回</Link>} />
    <div className="restored-orders-scroll">
      {loading && !order && <p className="restored-orders-state" role="status"><Spinner decorative />正在读取订单详情…</p>}
      {error && <div className="restored-orders-error"><p role="alert">{error}{stale ? '（当前详情可能已过期）' : ''}</p><Button variant="outline" onClick={onRetry} disabled={loading}>重试读取</Button></div>}
      {order && <>
        {!error && <div className="restored-orders-actions"><Button variant="outline" size="md" onClick={onRetry} loading={loading}>刷新详情</Button></div>}
        <SurfaceCard className="restored-order-detail-card"><header><Heading as="h1" variant="section">{order.goods.title}</Heading><span>{order.statusLabel}</span>{order.provenance === 'LOCAL_DEMO' ? <em>本地演示</em> : <em>历史未核验</em>}</header><p>订单号 {order.orderNo}</p><p>原始状态：<b>{order.status}</b></p><p>{order.goods.game.name} · {order.goods.regionName} · {order.goods.serverName} · {order.goods.accountMasked}</p></SurfaceCard>
        <SurfaceCard className="restored-order-detail-card"><Heading as="h2" variant="section">资金事实</Heading><OrderFinancialFacts order={order} detail /></SurfaceCard>
        <RestoredOrderLocalFulfillment key={`fulfillment-${order.id}`} orderId={order.id} />
        <RestoredOrderSignature key={order.id} orderId={order.id} seller={order.viewRoles.includes('SELLER')} />
        <RestoredOrderConfirmation key={`confirmation-${order.id}`} orderId={order.id} buyer={order.viewRoles.includes('BUYER')} />
        <RestoredOrderSettlement key={`settlement-${order.id}`} orderId={order.id} />
        <SurfaceCard className="restored-order-detail-card"><Heading as="h2" variant="section">归属与时间</Heading><dl className="restored-order-info"><div><dt>买家</dt><dd>{order.buyer.displayName}</dd></div><div><dt>卖家</dt><dd>{order.seller.displayName}</dd></div><div><dt>创建时间</dt><dd>{order.createdAt}</dd></div><div><dt>更新时间</dt><dd>{order.updatedAt}</dd></div></dl></SurfaceCard>
        {canContinueRestoredPayment(order) && <Link className="restored-order-payment-entry" to={`/orders/${encodeURIComponent(order.id)}/payment`}>继续本地模拟支付</Link>}
        <p className="restored-orders-readonly">仅显式确认操作会写入本地模拟支付或本人签署状态，不触发真实收款、签约或放款。</p>
      </>}
    </div>
  </main>
}

export function RestoredOrderListPage() {
  const { transport } = useRestoredClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const view: RestoredOrderView = searchParams.get('view') === 'sell' ? 'sell' : 'buy'
  const controller = useMemo(() => transport ? createRestoredOrdersController(createRestoredOrderApi(transport)) : null, [transport])
  const snapshot = useSyncExternalStore(controller?.subscribe ?? (() => () => undefined), controller?.getSnapshot ?? (() => listDisconnected), controller?.getSnapshot ?? (() => listDisconnected))
  useEffect(() => {
    if (!controller) return undefined
    const sync = () => { void controller.setVisible(document.visibilityState === 'visible') }
    sync(); void controller.start(view)
    document.addEventListener('visibilitychange', sync)
    return () => { document.removeEventListener('visibilitychange', sync); controller.stop() }
  }, [controller])
  useEffect(() => { if (controller && controller.getSnapshot().view !== view) void controller.setView(view) }, [controller, view])
  const visibleSnapshot = controller ? projectRestoredOrdersSnapshot(snapshot, view) : { ...listDisconnected, view }
  return <RestoredOrderListView snapshot={visibleSnapshot} onViewChange={next => setSearchParams({ view: next })} onRetry={() => { void controller?.retry() }} />
}

export function RestoredOrderDetailPage() {
  const { orderId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const returnView: RestoredOrderView = searchParams.get('view') === 'sell' ? 'sell' : 'buy'
  const { transport } = useRestoredClient()
  const controller = useMemo(() => transport ? createRestoredOrderDetailController(createRestoredOrderApi(transport)) : null, [transport])
  const snapshot = useSyncExternalStore(controller?.subscribe ?? (() => () => undefined), controller?.getSnapshot ?? (() => detailDisconnected), controller?.getSnapshot ?? (() => detailDisconnected))
  useEffect(() => {
    if (!controller) return undefined
    const sync = () => { void controller.setVisible(document.visibilityState === 'visible') }
    sync(); void controller.start(orderId)
    document.addEventListener('visibilitychange', sync)
    return () => { document.removeEventListener('visibilitychange', sync); controller.stop() }
  }, [controller])
  useEffect(() => { if (controller && controller.getSnapshot().orderId !== orderId) void controller.load(orderId) }, [controller, orderId])
  const visibleSnapshot = controller ? projectRestoredOrderDetailSnapshot(snapshot, orderId) : { ...detailDisconnected, orderId }
  return <RestoredOrderDetailView snapshot={visibleSnapshot} returnView={returnView} onRetry={() => { void controller?.retry() }} />
}
