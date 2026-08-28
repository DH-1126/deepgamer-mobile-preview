import { useMemo } from 'react'
import { ArrowLeft, Check, ChevronRight, Headphones, Search, ShieldCheck, X } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { AFTERSALE_TABS, filterAfterSales, getAfterSaleStatusLabel, isAfterSaleTab, type AfterSaleTab } from '../components/afterSalesModel'
import { assetPath } from '../components/assetPath'
import { afterSalesFixtures } from '../data/afterSalesFixtures'
import { SUPPORT_CONVERSATION_ROUTE } from '../data/messageFixtures'
import type { AfterSaleRecord, AfterSaleStatus } from '../types/aftersale'
import '../styles/aftersales-v2.css'

function AfterSaleStatusBar() {
  return <div className="aftersales-v2-status" aria-hidden="true"><time>9:41</time><span><img src={assetPath('assets/home-v2/status-signal.svg')} alt="" /><img src={assetPath('assets/home-v2/status-wifi.svg')} alt="" /><img src={assetPath('assets/home-v2/status-battery.svg')} alt="" /></span></div>
}

function AfterSaleTopBar({ title, support = false }: { title: string; support?: boolean }) {
  const navigate = useNavigate()
  return <><AfterSaleStatusBar /><header className="aftersales-v2-topbar"><button type="button" onClick={() => navigate(-1)} aria-label="返回"><ArrowLeft size={20} aria-hidden="true" /></button><h1>{title}</h1>{support ? <Link to={SUPPORT_CONVERSATION_ROUTE} aria-label="联系客服"><Headphones size={18} aria-hidden="true" /></Link> : <span />}</header></>
}

export function AfterSalesPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('query') ?? ''
  const rawStatus = params.get('status')
  const status: AfterSaleTab = isAfterSaleTab(rawStatus) ? rawStatus : 'pending_review'
  const visible = useMemo(() => filterAfterSales(afterSalesFixtures, status, query), [query, status])
  const update = (key: 'query' | 'status', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value); else next.delete(key)
    setParams(next, { replace: true })
  }
  return <main className="aftersales-v2-page">
    <header className="aftersales-v2-header"><AfterSaleTopBar title="售后记录" />
      <form className="aftersales-v2-search" role="search" onSubmit={(event) => event.preventDefault()}><Search size={17} aria-hidden="true" /><input value={query} onChange={(event) => update('query', event.target.value)} placeholder="请输入订单编号" aria-label="搜索售后单号、订单编号、商品或游戏" maxLength={80} />{query && <button type="button" onClick={() => update('query', '')} aria-label="清空搜索"><X size={15} /></button>}</form>
      <nav className="aftersales-v2-tabs" role="tablist" aria-label="售后状态筛选">{AFTERSALE_TABS.map((tab) => <button type="button" role="tab" key={tab.value} className={status === tab.value ? 'active' : ''} aria-selected={status === tab.value} onClick={() => update('status', tab.value)}>{tab.label}</button>)}</nav>
    </header>
    <div className="aftersales-v2-scroll">{visible.length ? visible.map((record) => <AfterSaleCard key={record.id} record={record} />) : <AfterSaleEmpty query={query} />}</div>
  </main>
}

function AfterSaleCard({ record }: { record: AfterSaleRecord }) {
  return <article className={`aftersales-v2-card status-${record.status}`}><header><span><em>{getAfterSaleStatusLabel(record.status)}</em><small>售后单 {record.id}</small></span><time>{record.updatedAt.slice(5)}</time></header><Link to={`/aftersales/${record.id}`}><div className="aftersales-v2-product"><img src={record.thumbnail} alt={record.gameName} /><span><b>{record.productTitle}</b><small>{record.gameName} · {record.server}</small><em>订单 {record.orderId}</em></span><strong><small>¥</small>{(record.refundAmountCents / 100).toFixed(2)}</strong></div><div className="aftersales-v2-reason"><span>申请原因</span><b>{record.reason}</b></div><footer><p>{record.statusMessage}</p><ChevronRight size={17} aria-hidden="true" /></footer></Link></article>
}

function AfterSaleEmpty({ query }: { query: string }) {
  return <section className="aftersales-v2-empty"><span aria-hidden="true">售</span><h2>{query ? '没有匹配的售后订单' : '暂无售后记录'}</h2><p>{query ? '请检查订单编号或尝试其他关键词。' : '当前状态下没有需要处理的售后订单。'}</p></section>
}

export function AfterSaleDetailPage() {
  const { id = '' } = useParams()
  const record = afterSalesFixtures.find((item) => item.id === id)
  if (!record) return <main className="aftersales-v2-page"><AfterSaleTopBar title="售后详情" /><AfterSaleEmpty query="" /></main>
  const steps = getAfterSaleSteps(record.status)
  return <main className="aftersales-v2-page"><AfterSaleTopBar title="售后详情" support /><div className="aftersales-v2-detail-scroll">
    <section className={`aftersales-v2-detail-hero status-${record.status}`}><span><b>{getAfterSaleStatusLabel(record.status)}</b><small>更新于 {record.updatedAt}</small></span><h2>{record.statusMessage}</h2><p>售后单号：{record.id}</p></section>
    <section className="aftersales-v2-detail-product"><div className="aftersales-v2-product"><img src={record.thumbnail} alt={record.gameName} /><span><b>{record.productTitle}</b><small>{record.gameName} · {record.server}</small><em>订单 {record.orderId}</em></span><strong><small>¥</small>{(record.refundAmountCents / 100).toFixed(2)}</strong></div></section>
    <section className="aftersales-v2-detail-section"><h2>申请信息</h2><dl><div><dt>申请原因</dt><dd>{record.reason}</dd></div><div><dt>问题描述</dt><dd>{record.description}</dd></div><div><dt>申请时间</dt><dd>{record.createdAt}</dd></div><div><dt>退款金额</dt><dd>¥{(record.refundAmountCents / 100).toFixed(2)}</dd></div></dl></section>
    <section className="aftersales-v2-detail-section"><h2>处理进度</h2><ol className="aftersales-v2-progress">{steps.map((step) => <li className={step.state} key={step.label}><i>{step.state === 'done' && <Check size={11} strokeWidth={3} aria-hidden="true" />}</i><span><b>{step.label}</b><small>{step.detail}</small></span></li>)}</ol></section>
    <section className="aftersales-v2-safe"><ShieldCheck size={18} aria-hidden="true" /><div><b>平台全程处理</b><p>退款和争议处理仅通过平台完成，请勿私下转账或提供验证码。</p></div></section>
    <div className="aftersales-v2-detail-actions"><Link to={SUPPORT_CONVERSATION_ROUTE}>联系客服</Link><Link className="primary" to="/aftersales?status=all">返回售后记录</Link></div>
  </div></main>
}

function getAfterSaleSteps(status: AfterSaleStatus) {
  const base = [{ label: '提交售后申请', detail: '平台已收到申请和相关说明', state: 'done' }]
  if (status === 'pending_review') return [...base, { label: '平台审核', detail: '正在核对订单和申请材料', state: 'current' }, { label: '处理完成', detail: '等待审核结论', state: 'upcoming' }]
  if (status === 'supplement') return [...base, { label: '补充材料', detail: '等待你补充必要截图或说明', state: 'current' }, { label: '平台审核', detail: '材料补齐后继续处理', state: 'upcoming' }]
  if (status === 'refunding') return [...base, { label: '平台审核通过', detail: '退款方案已确认', state: 'done' }, { label: '退款处理中', detail: '款项将按原支付路径退回', state: 'current' }]
  if (status === 'platform_processing') return [...base, { label: '平台介入', detail: '正在核对双方材料和交易记录', state: 'current' }, { label: '给出处理结果', detail: '处理完成后通过消息通知', state: 'upcoming' }]
  if (status === 'rejected') return [...base, { label: '平台审核', detail: '已完成材料核对', state: 'done' }, { label: '申请未通过', detail: '现有材料不支持本次售后诉求', state: 'error' }]
  return [...base, { label: '平台审核', detail: '售后方案已确认', state: 'done' }, { label: '处理完成', detail: '退款或补偿已经完成', state: 'done' }]
}
